import { App, Stack } from '@aws-cdk/core';
import '@aws-cdk/assert/jest';
import { AuthorizationType, AuthorizationConfig } from '@aws-cdk/aws-appsync';

import { AppSyncTransformer } from '../lib/index';

const apiKeyAuthorizationConfig: AuthorizationConfig = {
    defaultAuthorization: {
        authorizationType: AuthorizationType.API_KEY,
        apiKeyConfig: {
            description: "Auto generated API Key from construct",
            name: "dev",
            expires: "30"
        }
    }
}

test('GraphQL API Created', () => {
    const mockApp = new App();
    const stack = new Stack(mockApp, 'testing-stack');

    new AppSyncTransformer(stack, 'test-transformer', {
        schemaPath: 'testSchema.graphql',
        apiName: 'test-api',
        authorizationConfig: apiKeyAuthorizationConfig
    });

    expect(stack).toHaveResource('AWS::CloudFormation::Stack');
    expect(stack).toHaveResource('AWS::AppSync::GraphQLApi', {
        AuthenticationType: 'API_KEY',
        Name: 'test-api'
    });
});