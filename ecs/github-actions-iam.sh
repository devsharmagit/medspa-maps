#!/bin/bash
# Creates a least-privilege IAM user for GitHub Actions CI/CD.
# Run once, then add the output keys to GitHub Secrets.
set -e

ACCOUNT_ID="584537429324"
REGION="us-east-2"
USER_NAME="medspa-maps-github-actions"

echo "Creating IAM user: $USER_NAME"

aws iam create-user --user-name "$USER_NAME" 2>/dev/null || echo "(user already exists)"

# Inline policy — only what the pipeline needs
aws iam put-user-policy \
  --user-name "$USER_NAME" \
  --policy-name MedspaMapsDeployPolicy \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
      {
        \"Sid\": \"ECR\",
        \"Effect\": \"Allow\",
        \"Action\": [
          \"ecr:GetAuthorizationToken\",
          \"ecr:BatchCheckLayerAvailability\",
          \"ecr:GetDownloadUrlForLayer\",
          \"ecr:BatchGetImage\",
          \"ecr:InitiateLayerUpload\",
          \"ecr:UploadLayerPart\",
          \"ecr:CompleteLayerUpload\",
          \"ecr:PutImage\",
          \"ecr:DescribeRepositories\",
          \"ecr:CreateRepository\"
        ],
        \"Resource\": \"*\"
      },
      {
        \"Sid\": \"ECS\",
        \"Effect\": \"Allow\",
        \"Action\": [
          \"ecs:DescribeServices\",
          \"ecs:DescribeTaskDefinition\",
          \"ecs:RegisterTaskDefinition\",
          \"ecs:UpdateService\"
        ],
        \"Resource\": \"*\"
      },
      {
        \"Sid\": \"IAMPassRole\",
        \"Effect\": \"Allow\",
        \"Action\": \"iam:PassRole\",
        \"Resource\": \"arn:aws:iam::${ACCOUNT_ID}:role/medspa-maps-task-role\"
      },
      {
        \"Sid\": \"STS\",
        \"Effect\": \"Allow\",
        \"Action\": \"sts:GetCallerIdentity\",
        \"Resource\": \"*\"
      }
    ]
  }"

echo "Creating access keys..."
KEYS=$(aws iam create-access-key --user-name "$USER_NAME" \
  --query 'AccessKey.{ID:AccessKeyId,Secret:SecretAccessKey}' --output json)

ACCESS_KEY=$(echo "$KEYS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['ID'])")
SECRET_KEY=$(echo "$KEYS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Secret'])")

echo ""
echo "========================================"
echo "  Add these to GitHub Secrets:"
echo "  Repo → Settings → Secrets → Actions"
echo "========================================"
echo ""
echo "  AWS_ACCESS_KEY_ID     = $ACCESS_KEY"
echo "  AWS_SECRET_ACCESS_KEY = $SECRET_KEY"
echo ""
echo "  Also add these secrets for app config:"
echo "  (GitHub Actions does NOT use these directly —"
echo "   they live in AWS Secrets Manager. Just document them.)"
echo ""
echo "  Done. IAM user: $USER_NAME"
