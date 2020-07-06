import { GraphQLTransform } from 'graphql-transformer-core';
import { DynamoDBModelTransformer } from 'graphql-dynamodb-transformer';
import { ModelConnectionTransformer } from 'graphql-connection-transformer';
import { KeyTransformer } from 'graphql-key-transformer';
import { VersionedModelTransformer } from 'graphql-versioned-transformer';
import { ModelAuthTransformer, ModelAuthTransformerConfig } from 'graphql-auth-transformer'

// Import this way because FunctionTransformer.d.ts types were throwing an eror. And we didn't write this package so hope for the best :P
const { FunctionTransformer } = require('graphql-function-transformer');

import Resource from "cloudform-types/types/resource";

import { MyTransformer } from './cdk-transformer';

import { normalize } from 'path';
import * as fs from "fs";

export interface SchemaTransformerProps {
    schemaPath: string
    outputPath?: string
    enableDeletionProtection?: boolean
    enableSync?: boolean
}

export class SchemaTransformer {
    outputs: any
    resolvers: any
    schemaPath: string
    outputPath: string
    enableDeletionProtection: boolean
    enableSync: boolean
    authRolePolicy: Resource | undefined
    unauthRolePolicy: Resource | undefined

    constructor(props?: SchemaTransformerProps) {

        this.resolvers = {}

        this.schemaPath = props?.schemaPath || './schema.graphql';
        this.outputPath = props?.outputPath || './appsync';
        this.enableDeletionProtection = props?.enableDeletionProtection || false;
        this.enableSync = props?.enableSync || false
    }

    transform() {
        const authTransformerConfig: ModelAuthTransformerConfig = {
            authConfig: {
                defaultAuthentication: {
                    authenticationType: 'AMAZON_COGNITO_USER_POOLS',
                    userPoolConfig: {
                        userPoolId: '12345xyz'
                    }
                },
                additionalAuthenticationProviders: [

                    {
                        authenticationType: 'API_KEY',
                        apiKeyConfig: {
                            description: 'Testing',
                            apiKeyExpirationDays: 100
                        }
                    },
                    {
                        authenticationType: 'AWS_IAM'
                    }
                ]
            }
        }

        // Note: This is not exact as we are omitting the @searchable transformer.
        const transformer = new GraphQLTransform({
            transformers: [
                new DynamoDBModelTransformer(),
                new VersionedModelTransformer(),
                new FunctionTransformer(),
                new KeyTransformer(),
                new ModelConnectionTransformer(),
                new ModelAuthTransformer(authTransformerConfig),
                new MyTransformer(),
            ]
        })

        const schema = fs.readFileSync(this.schemaPath);
        const cfdoc = transformer.transform(schema.toString());

        // TODO: Get Unauth Role and Auth Role policies for authorization stuff
        this.authRolePolicy = cfdoc.rootStack.Resources?.AuthRolePolicy01 as Resource || undefined
        this.unauthRolePolicy = cfdoc.rootStack.Resources?.UnauthRolePolicy01 as Resource || undefined

        this.writeSchema(cfdoc.schema);
        this.writeResolversToFile(cfdoc.resolvers);

        this.outputs = cfdoc.rootStack.Outputs;

        return this.outputs;
    }

    getResolvers() {
        const statements = ['Query', 'Mutation', 'Subscription'];
        const resolversDirPath = normalize('./appsync/resolvers')
        if (fs.existsSync(resolversDirPath)) {
            const files = fs.readdirSync(resolversDirPath)
            files.forEach(file => {
                // Example: Mutation.createChannel.response
                let args = file.split('.')
                let typeName: string = args[0];
                let name: string = args[1]
                let templateType = args[2] // request or response
                let filepath = normalize(`${resolversDirPath}/${file}`)

                if (statements.indexOf(typeName) >= 0 || (this.outputs.NONE && this.outputs.NONE[name])) {
                    if (!this.resolvers[name]) {
                        this.resolvers[name] = {
                            typeName: typeName,
                            fieldName: name,
                        }
                    }

                    if (templateType === 'req') {
                        this.resolvers[name]['requestMappingTemplate'] = filepath
                    } else if (templateType === 'res') {
                        this.resolvers[name]['responseMappingTemplate'] = filepath
                    }

                } else { // This is a GSI
                    if (!this.resolvers['gsi']) {
                        this.resolvers['gsi'] = {}
                    }

                    let mapName = `${typeName}${name}`
                    if (!this.resolvers['gsi'][mapName]) {
                        this.resolvers['gsi'][mapName] = {
                            typeName: typeName,
                            fieldName: name,
                            tableName: name.charAt(0).toUpperCase() + name.slice(1)
                        }
                    }

                    if (templateType === 'req') {
                        this.resolvers['gsi'][mapName]['requestMappingTemplate'] = filepath
                    } else if (templateType === 'res') {
                        this.resolvers['gsi'][mapName]['responseMappingTemplate'] = filepath
                    }
                }
            })
        }

        return this.resolvers;
    }

    private writeSchema(schema: any) {
        if (!fs.existsSync(this.outputPath)) {
            fs.mkdirSync(this.outputPath);
        }

        fs.writeFileSync(`${this.outputPath}/schema.graphql`, schema)
    }

    private writeResolversToFile(resolvers: any) {
        if (!fs.existsSync(this.outputPath)) {
            fs.mkdirSync(this.outputPath);
        }

        const resolverFolderPath = normalize(this.outputPath + '/resolvers');
        if (fs.existsSync(resolverFolderPath)) {
            const files = fs.readdirSync(resolverFolderPath)
            files.forEach(file => fs.unlinkSync(resolverFolderPath + '/' + file))
            fs.rmdirSync(resolverFolderPath)
        }

        if (!fs.existsSync(resolverFolderPath)) {
            fs.mkdirSync(resolverFolderPath);
        }

        Object.keys(resolvers).forEach((key: any) => {
            const resolver = resolvers[key];
            const fileName = key.replace('.vtl', '');
            const resolverFilePath = normalize(`${resolverFolderPath}/${fileName}`);
            fs.writeFileSync(resolverFilePath, resolver);
        })
    }
}