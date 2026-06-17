#!/bin/bash
# Sets up GitHub Actions OIDC trust with AWS.
# Run once — no static keys needed in GitHub after this.
# Usage: bash ecs/setup-oidc.sh
set -e

ACCOUNT_ID="584537429324"
REGION="us-east-2"
GITHUB_ORG="G99agency"
GITHUB_REPO="medspa-maps"
ROLE_NAME="medspa-maps-github-oidc"

echo "=== GitHub OIDC Setup for AWS ==="
echo "Account: $ACCOUNT_ID | Repo: $GITHUB_ORG/$GITHUB_REPO"

# ── 1. Create OIDC Identity Provider (only needed once per AWS account) ────────
echo ""
echo "1. Creating GitHub OIDC provider..."
aws iam create-open-id-connect-provider \
  --url "https://token.actions.githubusercontent.com" \
  --client-id-list "sts.amazonaws.com" \
  --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1" \
  --region "$REGION" 2>/dev/null || echo "   (OIDC provider already exists)"
echo "   ✓ https://token.actions.githubusercontent.com"

# ── 2. Create IAM role with OIDC trust policy ──────────────────────────────────
echo ""
echo "2. Creating IAM role: $ROLE_NAME..."

TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_ORG}/*:*"
        }
      }
    }
  ]
}
EOF
)

aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document "$TRUST_POLICY" \
  --description "Assumed by GitHub Actions via OIDC for medspa-maps deployments" \
  2>/dev/null || \
aws iam update-assume-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-document "$TRUST_POLICY"

echo "   ✓ $ROLE_NAME"

# ── 3. Attach deploy permissions ───────────────────────────────────────────────
echo ""
echo "3. Attaching deploy permissions..."

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name MedspaMapsGitHubDeploy \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
      {
        \"Sid\": \"ECRAuth\",
        \"Effect\": \"Allow\",
        \"Action\": [\"ecr:GetAuthorizationToken\"],
        \"Resource\": \"*\"
      },
      {
        \"Sid\": \"ECRPush\",
        \"Effect\": \"Allow\",
        \"Action\": [
          \"ecr:BatchCheckLayerAvailability\",
          \"ecr:InitiateLayerUpload\",
          \"ecr:UploadLayerPart\",
          \"ecr:CompleteLayerUpload\",
          \"ecr:PutImage\",
          \"ecr:BatchGetImage\",
          \"ecr:GetDownloadUrlForLayer\",
          \"ecr:DescribeRepositories\",
          \"ecr:CreateRepository\"
        ],
        \"Resource\": \"arn:aws:ecr:${REGION}:${ACCOUNT_ID}:repository/medspa-maps\"
      },
      {
        \"Sid\": \"ECSDeploy\",
        \"Effect\": \"Allow\",
        \"Action\": [
          \"ecs:RegisterTaskDefinition\",
          \"ecs:DescribeTaskDefinition\",
          \"ecs:UpdateService\",
          \"ecs:DescribeServices\"
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
        \"Sid\": \"STSIdentity\",
        \"Effect\": \"Allow\",
        \"Action\": \"sts:GetCallerIdentity\",
        \"Resource\": \"*\"
      }
    ]
  }"

echo "   ✓ MedspaMapsGitHubDeploy policy attached"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

echo ""
echo "========================================"
echo "  OIDC Setup Complete!"
echo "========================================"
echo ""
echo "  Role ARN:"
echo "  $ROLE_ARN"
echo ""
echo "  Add ONE secret to GitHub:"
echo "  Repo → Settings → Secrets → Actions"
echo ""
echo "  AWS_ROLE_ARN = $ROLE_ARN"
echo ""
echo "  No access keys needed — GitHub gets a"
echo "  short-lived token per run via OIDC."
