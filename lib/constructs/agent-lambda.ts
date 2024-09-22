import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

interface AgentLambdaProps {
  entry: string;
  environment?: { [key: string]: string };
  vpc: ec2.IVpc;
}

export class AgentLambda extends Construct {
  public readonly function: lambda.NodejsFunction;

  constructor(scope: Construct, id: string, props: AgentLambdaProps) {
    super(scope, id);

    this.function = new lambda.NodejsFunction(this, 'Function', {
      entry: props.entry,
      handler: 'handler',
      runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      environment: props.environment,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      bundling: {
        externalModules: ['@aws-sdk/client-secrets-manager'],
      },
    });
  }}