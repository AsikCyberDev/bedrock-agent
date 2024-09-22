import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import * as https from 'https';
import { APIGatewayProxyHandler } from 'aws-lambda';

const secretsManager = new SecretsManagerClient({});

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Retrieve Pinecone API key from Secrets Manager
    const secretCommand = new GetSecretValueCommand({ SecretId: process.env.PINECONE_API_KEY_SECRET_ARN! });
    const secretData = await secretsManager.send(secretCommand);
    const pineconeApiKey = JSON.parse(secretData.SecretString!).apiKey;

    // Pinecone API endpoint
    const apiEndpoint = `https://controller.${process.env.PINECONE_ENVIRONMENT}.pinecone.io`;

    // Index creation options
    const indexOptions = {
      name: process.env.PINECONE_INDEX_NAME,
      dimension: 1536,  // Dimension for text-embedding-ada-002 model
      metric: 'cosine'
    };

    // Create the index
    const response: any = await new Promise((resolve, reject) => {
      const req = https.request(`${apiEndpoint}/databases`, {
        method: 'POST',
        headers: {
          'Api-Key': pineconeApiKey,
          'Content-Type': 'application/json'
        }
      }, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      });

      req.on('error', (error: Error) => reject(error));
      req.write(JSON.stringify(indexOptions));
      req.end();
    });

    if (response.statusCode === 201) {
      console.log('Pinecone index created successfully');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Pinecone index creation initiated', indexName: process.env.PINECONE_INDEX_NAME }),
      };
    } else {
      console.error('Failed to create Pinecone index:', response.body);
      throw new Error('Failed to create Pinecone index');
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};