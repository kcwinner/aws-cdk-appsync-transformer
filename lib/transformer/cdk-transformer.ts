import { Transformer, TransformerContext, getFieldArguments } from "graphql-transformer-core";

export class MyTransformer extends Transformer {
    tables: any
    noneDataSources: any

    constructor() {
        super(
            'MyTransformer',
            'directive @nullable on FIELD_DEFINITION'
        )

        this.tables = {}
        this.noneDataSources = {}
    }

    public after = (ctx: TransformerContext): void => {
        this.printWithoutFilePath(ctx);

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

    private buildTablesFromResource(resourceName: string, ctx: TransformerContext): void {
        const tableResource = ctx.template.Resources ? ctx.template.Resources[resourceName] : undefined

        const attributeDefinitions = tableResource?.Properties?.AttributeDefinitions
        const keySchema = tableResource?.Properties?.KeySchema

        let keys = this.parseKeySchema(keySchema, attributeDefinitions);

        let table = {
            TableName: resourceName,
            PartitionKey: keys.partitionKey,
            SortKey: keys.sortKey,
            TTL: tableResource?.Properties?.TimeToLiveSpecification,
            GlobalSecondaryIndexes: [] as any[]
        }

        const gsis = tableResource?.Properties?.GlobalSecondaryIndexes;
        if (gsis) {
            gsis.forEach((gsi: any) => {
                let gsiKeys = this.parseKeySchema(gsi.KeySchema, attributeDefinitions);
                let gsiDefinition = {
                    IndexName: gsi.IndexName,
                    Projection: gsi.Projection,
                    PartitionKey: gsiKeys.partitionKey,
                    SortKey: gsiKeys.sortKey,
                }

                table.GlobalSecondaryIndexes.push(gsiDefinition);
            })
        }

        this.tables[resourceName] = table
    }

    private parseKeySchema(keySchema: any, attributeDefinitions: any,) {
        let partitionKey: any = {}
        let sortKey: any = {}

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

        return {
            partitionKey,
            sortKey
        }
    }
}