import { Transformer, TransformerContext, getFieldArguments } from "graphql-transformer-core";
import { normalize } from "path";
import fs = require('fs');

export class MyTransformer extends Transformer {
    outputPath: string | undefined
    tables: any
    noneDataSources: any

    constructor(outputPath?: string) {
        super(
            'MyTransformer',
            'directive @nullable on FIELD_DEFINITION'
        )

        this.outputPath = outputPath ? normalize(outputPath) : undefined;
        this.tables = {}
        this.noneDataSources = {}
    }

    public after = (ctx: TransformerContext): void => {
        if (!this.outputPath) {
            this.printWithoutFilePath(ctx);
        } else {
            this.printWithFilePath(ctx);
            this.tables.forEach((table: any) => {
                this.writeTableToFile(table)
            })
        }

        ctx.setOutput('CDK_TABLES', this.tables);
        ctx.setOutput('NONE', this.noneDataSources);

        let query = ctx.getQuery();
        let queryFields = getFieldArguments(query);
        ctx.setOutput('QUERIES', queryFields);

        let mutation = ctx.getMutation();
        let mutationFields = getFieldArguments(mutation);
        ctx.setOutput('MUTATIONS', mutationFields);

        let subscription = ctx.getSubscription();
        let subscriptionFields = getFieldArguments(subscription);
        ctx.setOutput('SUBSCRIPTIONS', subscriptionFields);
    }

    private printWithoutFilePath(ctx: TransformerContext): void {
        const templateResources = ctx.template.Resources
        if (!templateResources) return;

        for (const resourceName of Object.keys(templateResources)) {
            const resource = templateResources[resourceName]
            if (resource.Type === 'AWS::DynamoDB::Table') {
                this.buildTablesFromResource(resourceName, ctx)
            } else if (resource.Type === 'AWS::AppSync::Resolver') {
                if (resource.Properties?.DataSourceName === 'NONE') {
                    this.noneDataSources[resource.Properties.FieldName] = {
                        typeName: resource.Properties.TypeName,
                        fieldName: resource.Properties.FieldName
                    }
                }
            }
        }
    }

    private printWithFilePath(ctx: TransformerContext): void {
        if (!this.outputPath) return;
        
        if (!fs.existsSync(this.outputPath)) {
            fs.mkdirSync(this.outputPath);
        }

        const tableFilePath = normalize(this.outputPath + '/tables')
        if (fs.existsSync(tableFilePath)) {
            const files = fs.readdirSync(tableFilePath)
            files.forEach(file => fs.unlinkSync(tableFilePath + '/' + file))
            fs.rmdirSync(tableFilePath)
        }

        const templateResources = ctx.template.Resources
        if (!templateResources) return;

        for (const resourceName of Object.keys(templateResources)) {
            const resource = templateResources[resourceName]
            if (resource.Type === 'AWS::DynamoDB::Table') {
                this.buildTablesFromResource(resourceName, ctx)
            }
        }
    }

    private buildTablesFromResource(resourceName: string, ctx: TransformerContext): void {
        const tableResource = ctx.template.Resources ? ctx.template.Resources[resourceName] : undefined

        let partitionKey: any = {}
        let sortKey: any = {}

        const attributeDefinitions = tableResource?.Properties?.AttributeDefinitions
        const keySchema = tableResource?.Properties?.KeySchema

        if (keySchema.length == 1) {
            partitionKey = {
                name: attributeDefinitions[0].AttributeName,
                type: attributeDefinitions[0].AttributeType
            }
        } else {
            keySchema.forEach((key: any) => {
                let keyType = key.KeyType
                let attributeName = key.AttributeName

                let attribute = attributeDefinitions.find((attribute: any) => {
                    return attribute.AttributeName === attributeName
                })

                if (keyType === 'HASH') {
                    partitionKey = {
                        name: attribute.AttributeName,
                        type: attribute.AttributeType
                    }
                } else if (keyType === 'RANGE') {
                    sortKey = {
                        name: attribute.AttributeName,
                        type: attribute.AttributeType
                    }
                }
            })
        }

        this.tables[resourceName] = {
            TableName: resourceName,
            KeySchema: keySchema,
            AttributeDefinitions: attributeDefinitions,
            PartitionKey: partitionKey,
            SortKey: sortKey
        }
    }

    private writeTableToFile(table: any): void {
        const tableFilePath = normalize(this.outputPath + '/tables')
        if (!fs.existsSync(tableFilePath)) {
            fs.mkdirSync(tableFilePath);
        }

        fs.writeFileSync(`${tableFilePath}/${table.TableName}.json`, JSON.stringify(table))
    }
}