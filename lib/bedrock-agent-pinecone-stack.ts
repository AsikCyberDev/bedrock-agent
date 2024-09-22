import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { AgentLambda } from './constructs/agent-lambda';
import { PineconeVectorStore } from './constructs/pinecone-vector-store';
import * as path from 'path';


export class BedrockAgentPineconeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB tables
    const chatbotTable = new dynamodb.Table(this, 'ChatbotTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const agentTable = new dynamodb.Table(this, 'AgentTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Create S3 bucket for documents
    const documentBucket = new s3.Bucket(this, 'DocumentBucket', {
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Create VPC
    const vpc = new ec2.Vpc(this, 'BedrockVPC', {
      maxAzs: 2,
      natGateways: 1,
    });

    // Create IAM roles
    const agentRole = new iam.Role(this, 'BedrockAgentRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'Role for Bedrock Agent to access necessary resources',
    });

    const knowledgeBaseRole = new iam.Role(this, 'KnowledgeBaseRole', {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('bedrock.amazonaws.com'),
        new iam.ServicePrincipal('lambda.amazonaws.com')
      ),
      description: 'Role for Knowledge Base to access necessary resources',
    });

    // Add necessary permissions to the roles
    agentRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan',
      ],
      resources: [chatbotTable.tableArn, agentTable.tableArn],
    }));

    knowledgeBaseRole.addToPolicy(new iam.PolicyStatement({
      actions: ['bedrock:*'],
      resources: ['*'],
    }));

    knowledgeBaseRole.addToPolicy(new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [knowledgeBaseRole.roleArn],
    }));

    // Create a secret for Pinecone API key
    const pineconeApiKey = new secretsmanager.Secret(this, 'PineconeApiKey', {
      description: 'API key for Pinecone',
    });

    // Create Pinecone vector store construct
    const pineconeVectorStore = new PineconeVectorStore(this, 'PineconeVectorStore', {
      apiKeySecret: pineconeApiKey,
      environment: 'us-west1-gcp',  // Replace with your Pinecone environment
      indexName: 'bedrock-kb-index',  // Replace with your desired index name
    });

    // Create Lambda functions
    const createPineconeIndexLambda = new AgentLambda(this, 'CreatePineconeIndexLambda', {
      entry: path.join(__dirname, '../src/lambdas/create-pinecone-index.ts'),
      environment: {
        PINECONE_API_KEY_SECRET_ARN: pineconeApiKey.secretArn,
        PINECONE_ENVIRONMENT: pineconeVectorStore.environment,
        PINECONE_INDEX_NAME: pineconeVectorStore.indexName,
      },
      vpc,
    });

    // ... Create other Lambda functions similarly

    // Grant necessary permissions
    pineconeApiKey.grantRead(createPineconeIndexLambda.function);
    // ... Grant other necessary permissions

    // Create Step Functions state machine (to be implemented)

    // Output important information
    new cdk.CfnOutput(this, 'ChatbotTableName', { value: chatbotTable.tableName });
    new cdk.CfnOutput(this, 'AgentTableName', { value: agentTable.tableName });
    new cdk.CfnOutput(this, 'AgentRoleArn', { value: agentRole.roleArn });
    new cdk.CfnOutput(this, 'KnowledgeBaseRoleArn', { value: knowledgeBaseRole.roleArn });
    new cdk.CfnOutput(this, 'VpcId', { value: vpc.vpcId });
    new cdk.CfnOutput(this, 'DocumentBucketName', { value: documentBucket.bucketName });
    new cdk.CfnOutput(this, 'PineconeApiKeySecretArn', { value: pineconeApiKey.secretArn });
  }
}