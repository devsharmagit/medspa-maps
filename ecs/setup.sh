#!/bin/bash
# Run once to set up all AWS infrastructure for medspa-maps.
# Usage: bash ecs/setup.sh
set -e

ACCOUNT_ID="584537429324"
REGION="us-east-2"
APP="medspa-maps"
CLUSTER="medspa-maps-cluster"

echo "=== MedSpa Maps — AWS Setup ==="
echo "Account: $ACCOUNT_ID | Region: $REGION"

# ── 1. ECR repository ─────────────────────────────────────────────────────────
echo ""
echo "1. Creating ECR repository..."
aws ecr create-repository \
  --repository-name "$APP" \
  --region "$REGION" \
  --image-scanning-configuration scanOnPush=true 2>/dev/null || echo "   (already exists)"

ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${APP}"
echo "   ✓ $ECR_URI"

# ── 2. ECS Cluster ────────────────────────────────────────────────────────────
echo ""
echo "2. Creating ECS cluster..."
aws ecs create-cluster \
  --cluster-name "$CLUSTER" \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy \
    capacityProvider=FARGATE_SPOT,weight=4,base=0 \
    capacityProvider=FARGATE,weight=1,base=1 \
  --region "$REGION" 2>/dev/null || echo "   (already exists)"
echo "   ✓ $CLUSTER"

# ── 3. IAM role for ECS task ──────────────────────────────────────────────────
echo ""
echo "3. Creating IAM execution role..."
aws iam create-role \
  --role-name medspa-maps-task-role \
  --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]
  }' 2>/dev/null || echo "   (already exists)"

aws iam attach-role-policy \
  --role-name medspa-maps-task-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy 2>/dev/null || true

aws iam attach-role-policy \
  --role-name medspa-maps-task-role \
  --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess 2>/dev/null || true

echo "   ✓ medspa-maps-task-role"

# ── 4. CloudWatch log group ───────────────────────────────────────────────────
echo ""
echo "4. Creating CloudWatch log group..."
aws logs create-log-group \
  --log-group-name "/ecs/medspa-maps" \
  --region "$REGION" 2>/dev/null || echo "   (already exists)"
aws logs put-retention-policy \
  --log-group-name "/ecs/medspa-maps" \
  --retention-in-days 14 \
  --region "$REGION"
echo "   ✓ /ecs/medspa-maps (14 day retention)"

# ── 5. Secrets Manager ────────────────────────────────────────────────────────
echo ""
echo "5. Creating Secrets Manager entries..."
echo "   ⚠  Edit these values before running in production!"

create_or_update_secret() {
  local name=$1
  local value=$2
  aws secretsmanager create-secret \
    --name "$name" --secret-string "$value" \
    --region "$REGION" 2>/dev/null || \
  aws secretsmanager put-secret-value \
    --secret-id "$name" --secret-string "$value" \
    --region "$REGION" > /dev/null
  echo "   ✓ $name"
}

create_or_update_secret "medspa-maps/DATABASE_URL"         "postgres://user:pass@your-rds-host:5432/medspa_maps"
create_or_update_secret "medspa-maps/G99_DATABASE_URL"     "postgres://user:pass@your-rds-host:5432/g99"
create_or_update_secret "medspa-maps/NEXTAUTH_SECRET"      "replace-with-32-char-random-string"
create_or_update_secret "medspa-maps/INTERNAL_API_SECRET"  "replace-with-32-char-random-string"

# Allow task role to read secrets
aws iam put-role-policy \
  --role-name medspa-maps-task-role \
  --policy-name SecretsManagerAccess \
  --policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[{
      \"Effect\":\"Allow\",
      \"Action\":[\"secretsmanager:GetSecretValue\",\"kms:Decrypt\"],
      \"Resource\":\"arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:medspa-maps/*\"
    }]
  }"

# ── 6. Register task definition ───────────────────────────────────────────────
echo ""
echo "6. Registering task definition..."
TASK_DEF=$(sed \
  -e "s|ACCOUNT_ID|${ACCOUNT_ID}|g" \
  -e "s|REGION|${REGION}|g" \
  "$(dirname "$0")/task-definition.json")

echo "$TASK_DEF" | aws ecs register-task-definition \
  --cli-input-json file:///dev/stdin \
  --region "$REGION" \
  --query 'taskDefinition.taskDefinitionArn' --output text
echo "   ✓ task definition registered"

echo ""
echo "========================================"
echo "  Setup complete!"
echo "========================================"
echo ""
echo "  Next steps:"
echo "  1. Update secret values in AWS Secrets Manager"
echo "  2. Create VPC/subnets/security groups (if not done)"
echo "  3. Create ECS service:"
echo "     aws ecs create-service --cluster $CLUSTER \\"
echo "       --service-name medspa-maps-service \\"
echo "       --task-definition medspa-maps \\"
echo "       --desired-count 1 \\"
echo "       --launch-type FARGATE \\"
echo "       --network-configuration 'awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}' \\"
echo "       --region $REGION"
echo ""
echo "  4. Add GitHub secrets (see .github/workflows/deploy.yml)"
echo ""
echo "  ECR URI: $ECR_URI"
