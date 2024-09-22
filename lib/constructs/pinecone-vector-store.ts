import { Construct } from 'constructs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

interface PineconeVectorStoreProps {
  apiKeySecret: secretsmanager.ISecret;
  environment: string;
  indexName: string;
}

export class PineconeVectorStore extends Construct {
  public readonly apiKeySecret: secretsmanager.ISecret;
  public readonly environment: string;
  public readonly indexName: string;

  constructor(scope: Construct, id: string, props: PineconeVectorStoreProps) {
    super(scope, id);

    this.apiKeySecret = props.apiKeySecret;
    this.environment = props.environment;
    this.indexName = props.indexName;
  }
}