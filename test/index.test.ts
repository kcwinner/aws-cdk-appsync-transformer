import { App, Stack } from '@aws-cdk/core';
import '@aws-cdk/assert/jest';
import { AuthorizationType, AuthorizationConfig, UserPoolDefaultAction } from '@aws-cdk/aws-appsync';
import { UserPool, UserPoolClient } from '@aws-cdk/aws-cognito';

import { AppSyncTransformer } from '../lib/index';

const apiKeyAuthorizationConfig: AuthorizationConfig = {
    defaultAuthorization: {
        authorizationType: AuthorizationType.API_KEY,
        apiKeyConfig: {
            description: "Auto generated API Key from construct",
            name: "dev",
        }
    }
}

test('GraphQL API W/ Defaults Created', () => {
    const mockApp = new App();
    const stack = new Stack(mockApp, 'testing-stack');

    const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
        schemaPath: 'testSchema.graphql',
        authorizationConfig: apiKeyAuthorizationConfig
    });

    expect(stack).toHaveResource('AWS::CloudFormation::Stack');
    expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::AppSync::GraphQLApi', {
        AuthenticationType: 'API_KEY'
    });
});

test('GraphQL API W/ Sync Created', () => {
    const mockApp = new App();
    const stack = new Stack(mockApp, 'testing-stack');

    const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
        schemaPath: 'testSchema.graphql',
        apiName: 'sync-api',
        authorizationConfig: apiKeyAuthorizationConfig,
        syncEnabled: true
    });

    expect(stack).toHaveResource('AWS::CloudFormation::Stack');
    expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::AppSync::GraphQLApi', {
        AuthenticationType: 'API_KEY',
        Name: 'sync-api'
    });
});

test('GraphQL API W/ User Pool Auth Created', () => {
    const mockApp = new App();
    const stack = new Stack(mockApp, 'user-pool-auth-stack');
    
    const userPool = new UserPool(stack, 'test-userpool');
    const userPoolClient = new UserPoolClient(stack, 'test-userpool-client', {
        userPool: userPool
    })

    const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
        schemaPath: 'testSchema.graphql',
        apiName: 'user-pool-auth-api',
        authorizationConfig: {
            defaultAuthorization: {
                authorizationType: AuthorizationType.USER_POOL,
                userPoolConfig: {
                    userPool: userPool,
                    appIdClientRegex: userPoolClient.userPoolClientId,
                    defaultAction: UserPoolDefaultAction.ALLOW
                }
            }
        }
    });

    expect(stack).toHaveResource('AWS::CloudFormation::Stack');
    expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::AppSync::GraphQLApi', {
        AuthenticationType: 'AMAZON_COGNITO_USER_POOLS',
        Name: 'user-pool-auth-api'
    });
});