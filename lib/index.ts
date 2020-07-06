import { Construct, NestedStack, CfnOutput } from '@aws-cdk/core';
import { GraphQLApi, AuthorizationType, FieldLogLevel, MappingTemplate, CfnDataSource, Resolver, AuthorizationConfig } from '@aws-cdk/aws-appsync';
import { Table, AttributeType, ProjectionType, BillingMode } from '@aws-cdk/aws-dynamodb';
// import { Function, Runtime, Code } from '@aws-cdk/aws-lambda';

import { SchemaTransformer } from './transformer/schema-transformer';

export interface AppSyncTransformerProps {
    readonly schemaPath: string
    readonly authorizationConfig?: AuthorizationConfig
    readonly apiName?: string
}

const defaultAuthorizationConfig: AuthorizationConfig = {
    defaultAuthorization: {
        authorizationType: AuthorizationType.API_KEY,
        apiKeyConfig: {
            description: "Auto generated API Key from construct",
            name: "dev",
            expires: "100"
        },
    }
}

export class AppSyncTransformer extends Construct {
    public readonly appsyncAPI: GraphQLApi
    public readonly nestedAppsyncStack: NestedStack;
    public readonly tableNameMap: any;

    constructor(scope: Construct, id: string, props: AppSyncTransformerProps) {
        super(scope, id);

        const transformerConfiguration = {
            schemaPath: props.schemaPath
        }

        const transformer = new SchemaTransformer(transformerConfiguration);
        const outputs = transformer.transform();
        const resolvers = transformer.getResolvers();

        this.nestedAppsyncStack = new NestedStack(this, `appsync-nested-stack`);

        // AppSync
        this.appsyncAPI = new GraphQLApi(this, `${id}-api`, {
            name: props.apiName ? props.apiName : `${id}-api`,
            authorizationConfig: props.authorizationConfig ? props.authorizationConfig : defaultAuthorizationConfig,
            logConfig: {
                fieldLogLevel: FieldLogLevel.NONE,
            },
            schemaDefinitionFile: './appsync/schema.graphql'
        })

        let tableData = outputs.CDK_TABLES;
        this.tableNameMap = this.createTablesAndResolvers(tableData, resolvers);
        this.createNoneDataSourceAndResolvers(outputs.NONE, resolvers);

        // Outputs so we can generate exports
        new CfnOutput(this, 'appsyncGraphQLEndpointOutput', {
            value: this.appsyncAPI.graphQlUrl,
            description: 'Output for aws_appsync_graphqlEndpoint'
        })
    }

    private createNoneDataSourceAndResolvers(none: any, resolvers: any) {
        const noneDataSource = this.appsyncAPI.addNoneDataSource('NONE', 'None datasource for subscriptions and stuff');

        Object.keys(none).forEach((resolverKey: any) => {
            let resolver = resolvers[resolverKey];

            new Resolver(this.nestedAppsyncStack, `${resolver.typeName}-${resolver.fieldName}-resolver`, {
                api: this.appsyncAPI,
                typeName: resolver.typeName,
                fieldName: resolver.fieldName,
                dataSource: noneDataSource,
                requestMappingTemplate: MappingTemplate.fromFile(resolver.requestMappingTemplate),
                responseMappingTemplate: MappingTemplate.fromFile(resolver.responseMappingTemplate),
            })
        })
    }

    private createTablesAndResolvers(tableData: any, resolvers: any) {
        const tableNameMap: any = {};

        Object.keys(tableData).forEach((tableKey: any) => {
            const table = this.createTable(tableData[tableKey]);
            const dataSource = this.appsyncAPI.addDynamoDbDataSource(tableKey, `Data source for ${tableKey}`, table);

            const dynamoDbConfig = dataSource.ds.dynamoDbConfig as CfnDataSource.DynamoDBConfigProperty;
            tableNameMap[tableKey] = dynamoDbConfig.tableName;

            Object.keys(resolvers).forEach((resolverKey: any) => {
                let resolverTableName = this.getTableNameFromFieldName(resolverKey)
                if (tableKey === resolverTableName) {
                    let resolver = resolvers[resolverKey];

                    new Resolver(this.nestedAppsyncStack, `${resolver.typeName}-${resolver.fieldName}-resolver`, {
                        api: this.appsyncAPI,
                        typeName: resolver.typeName,
                        fieldName: resolver.fieldName,
                        dataSource: dataSource,
                        requestMappingTemplate: MappingTemplate.fromFile(resolver.requestMappingTemplate),
                        responseMappingTemplate: MappingTemplate.fromFile(resolver.responseMappingTemplate),
                    })
                }
            })

            let gsiResolvers = resolvers['gsi'];
            if (gsiResolvers) {
                Object.keys(gsiResolvers).forEach((resolverKey: any) => {
                    let tableNameKey = gsiResolvers[resolverKey]['tableName'];
                    let resolverTableName = this.getTableNameFromFieldName(tableNameKey)

                    if (tableKey === resolverTableName) {
                        let resolver = gsiResolvers[resolverKey]

                        new Resolver(this.nestedAppsyncStack, `${resolver.typeName}-${resolver.fieldName}-resolver`, {
                            api: this.appsyncAPI,
                            typeName: resolver.typeName,
                            fieldName: resolver.fieldName,
                            dataSource: dataSource,
                            requestMappingTemplate: MappingTemplate.fromFile(resolver.requestMappingTemplate),
                            responseMappingTemplate: MappingTemplate.fromFile(resolver.responseMappingTemplate),
                        })
                    }
                })
            }
        });

        return tableNameMap;
    }

    private createTable(tableData: any) {
        let tableProps: any = {
            billingMode: BillingMode.PAY_PER_REQUEST,
            partitionKey: {
                name: tableData.PartitionKey.name,
                type: this.convertAttributeType(tableData.PartitionKey.type)
            }
        };

        if (tableData.SortKey && tableData.SortKey.name) {
            tableProps.sortKey = {
                name: tableData.SortKey.name,
                type: this.convertAttributeType(tableData.SortKey.type)
            };
        };

        if (tableData.TTL && tableData.TTL.Enabled) {
            tableProps.timeToLiveAttribute = tableData.TTL.AttributeName;
        }

        let table = new Table(this.nestedAppsyncStack, tableData.TableName, tableProps);

        if (tableData.GlobalSecondaryIndexes && tableData.GlobalSecondaryIndexes.length > 0) {
            tableData.GlobalSecondaryIndexes.forEach((gsi: any) => {
                table.addGlobalSecondaryIndex({
                    indexName: gsi.IndexName,
                    partitionKey: {
                        name: gsi.PartitionKey.name,
                        type: this.convertAttributeType(gsi.PartitionKey.type)
                    },
                    projectionType: this.convertProjectionType(gsi.Projection.ProjectionType)
                })
            })
        }

        return table;
    }

    private convertAttributeType(type: any) {
        if (type === 'S') {
            return AttributeType.STRING
        } else if (type === 'N') {
            return AttributeType.NUMBER
        } else if (type === 'B') {
            return AttributeType.BINARY
        }

        return AttributeType.STRING
    }

    private convertProjectionType(type: string) {
        switch (type) {
            case 'ALL':
                return ProjectionType.ALL
            case 'INCLUDE':
                return ProjectionType.INCLUDE
            case 'KEYS_ONLY':
                return ProjectionType.KEYS_ONLY
            default:
                return ProjectionType.ALL
        }
    }

    private getTableNameFromFieldName(fieldName: string) {
        let tableName = ''
        let plural = false
        let replace = ''

        if (fieldName.indexOf('list') > -1) {
            replace = 'list'
            plural = true
        } else if (fieldName.indexOf('get') > -1) {
            replace = 'get'
        } else if (fieldName.indexOf('delete') > -1) {
            replace = 'delete'
        } else if (fieldName.indexOf('create') > -1) {
            replace = 'create'
        } else if (fieldName.indexOf('update') > -1) {
            replace = 'update'
        }

        tableName = fieldName.replace(replace, '')

        if (plural) {
            tableName = tableName.slice(0, -1)
        }

        return tableName + 'Table'
    }
}