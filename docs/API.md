# API Reference

**Classes**

Name|Description
----|-----------
[AppSyncTransformer](#aws-cdk-appsync-transformer-appsynctransformer)|*No description*


**Structs**

Name|Description
----|-----------
[AppSyncTransformerProps](#aws-cdk-appsync-transformer-appsynctransformerprops)|*No description*



## class AppSyncTransformer 🔹 <a id="aws-cdk-appsync-transformer-appsynctransformer"></a>



__Implements__: [IConstruct](#constructs-iconstruct), [IConstruct](#aws-cdk-core-iconstruct), [IConstruct](#constructs-iconstruct), [IDependable](#aws-cdk-core-idependable)
__Extends__: [Construct](#aws-cdk-core-construct)

### Initializer




```ts
new AppSyncTransformer(scope: Construct, id: string, props: AppSyncTransformerProps)
```

* **scope** (<code>[Construct](#aws-cdk-core-construct)</code>)  *No description*
* **id** (<code>string</code>)  *No description*
* **props** (<code>[AppSyncTransformerProps](#aws-cdk-appsync-transformer-appsynctransformerprops)</code>)  *No description*
  * **schemaPath** (<code>string</code>)  *No description* 
  * **apiName** (<code>string</code>)  *No description* __*Optional*__
  * **authorizationConfig** (<code>[AuthorizationConfig](#aws-cdk-aws-appsync-authorizationconfig)</code>)  *No description* __*Optional*__
  * **syncEnabled** (<code>boolean</code>)  *No description* __*Optional*__



### Properties


Name | Type | Description 
-----|------|-------------
**appsyncAPI**🔹 | <code>[GraphQLApi](#aws-cdk-aws-appsync-graphqlapi)</code> | <span></span>
**nestedAppsyncStack**🔹 | <code>[NestedStack](#aws-cdk-core-nestedstack)</code> | <span></span>
**tableNameMap**🔹 | <code>any</code> | <span></span>

### Methods


#### createSyncTable(tableData)🔹 <a id="aws-cdk-appsync-transformer-appsynctransformer-createsynctable"></a>



```ts
createSyncTable(tableData: any): Table
```

* **tableData** (<code>any</code>)  *No description*

__Returns__:
* <code>[Table](#aws-cdk-aws-dynamodb-table)</code>



## struct AppSyncTransformerProps 🔹 <a id="aws-cdk-appsync-transformer-appsynctransformerprops"></a>






Name | Type | Description 
-----|------|-------------
**schemaPath**🔹 | <code>string</code> | <span></span>
**apiName**?🔹 | <code>string</code> | __*Optional*__
**authorizationConfig**?🔹 | <code>[AuthorizationConfig](#aws-cdk-aws-appsync-authorizationconfig)</code> | __*Optional*__
**syncEnabled**?🔹 | <code>boolean</code> | __*Optional*__



