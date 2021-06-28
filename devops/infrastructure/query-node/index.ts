import * as awsx from '@pulumi/awsx'
import * as eks from '@pulumi/eks'
// import * as k8s from '@pulumi/kubernetes'
import * as docker from '@pulumi/docker'
import * as pulumi from '@pulumi/pulumi'
import * as k8sjs from './k8sjs'
import * as k8s from '@pulumi/kubernetes'

require('dotenv').config()

// const awsConfig = new pulumi.Config('aws')

// // Create a VPC for our cluster.
// const vpc = new awsx.ec2.Vpc('vpc', { numberOfAvailabilityZones: 2 })

// // Create an EKS cluster with the default configuration.
// const cluster = new eks.Cluster('eksctl-my-cluster', {
//   vpcId: vpc.id,
//   subnetIds: vpc.publicSubnetIds,
//   instanceType: 't2.large',
//   providerCredentialOpts: {
//     profileName: awsConfig.get('profile'),
//   },
// })

// // Export the cluster's kubeconfig.
// export const kubeconfig = cluster.kubeconfig

// // Create a repository
// const repo = new awsx.ecr.Repository('joystream/apps')

// export const joystreamAppsImage = repo.buildAndPushImage({
//   dockerfile: '../../../apps.Dockerfile',
//   context: '../../../',
// })

// Create image from local app
// export const joystreamAppsImage = new docker.Image('joystream/apps', {
//   build: {
//     context: '../../../',
//     dockerfile: '../../../apps.Dockerfile',
//   },
//   imageName: 'joystream/apps:latest',
//   skipPush: true,
//   localImageName: 'joystream/apps:latest',
// }).imageName

export const joystreamAppsImage = 'joystream/apps'

const name = 'query-node'

// Create a Kubernetes Namespace
// const ns = new k8s.core.v1.Namespace(name, {}, { provider: cluster.provider })
const ns = new k8s.core.v1.Namespace(name, {})

// Export the Namespace name
export const namespaceName = ns.metadata.name

// Create a NGINX Deployment
const appLabels = { appClass: name }
const deployment = new k8s.apps.v1.Deployment(
  name,
  {
    metadata: {
      namespace: namespaceName,
      labels: appLabels,
    },
    spec: {
      replicas: 1,
      selector: { matchLabels: appLabels },
      template: {
        metadata: {
          labels: appLabels,
        },
        spec: {
          hostname: 'postgres-db',
          containers: [
            {
              name: 'redis',
              image: 'redis:6.0-alpine',
              ports: [{ containerPort: 6379 }],
            },
            {
              name: 'postgres-db',
              image: 'postgres:12',
              env: [
                { name: 'POSTGRES_USER', value: process.env.DB_USER! },
                { name: 'POSTGRES_PASSWORD', value: process.env.DB_PASS! },
                { name: 'POSTGRES_DB', value: process.env.INDEXER_DB_NAME! },
              ],
              ports: [{ containerPort: 5432 }],
            },
            {
              name: 'temp-db-prepare-container',
              image: joystreamAppsImage,
              imagePullPolicy: 'Never',
              env: [
                {
                  name: 'DB_HOST',
                  value: 'postgres-db',
                },
              ],
              command: ['/bin/sh', '-c'],
              args: ['yarn workspace query-node-root db:prepare; yarn workspace query-node-root db:migrate'],
            },
            // {
            //   name: 'indexer',
            //   image: 'joystream/hydra-indexer:2.1.0-beta.9',
            //   env: [
            //     { name: 'DB_HOST', value: 'postgres-db' },
            //     { name: 'DB_NAME', value: process.env.INDEXER_DB_NAME! },
            //     { name: 'INDEXER_WORKERS', value: '5' },
            //     { name: 'REDIS_URI', value: 'redis://redis:6379/0' },
            //     { name: 'DEBUG', value: 'index-builder:*' },
            //     { name: 'WS_PROVIDER_ENDPOINT_URI', value: process.env.WS_PROVIDER_ENDPOINT_URI! },
            //     { name: 'TYPES_JSON', value: 'types.json' },
            //   ],
            //   // volumeMounts: [
            //   //   {
            //   //     mountPath: '/home/hydra/packages/hydra-indexer/types.json',
            //   //     name: 'indexer-volume',
            //   //   },
            //   // ],
            //   command: ['sh', '-c', 'yarn db:bootstrap && yarn start:prod'],
            // },
            // {
            //   name: 'hydra-indexer-gateway',
            //   image: 'joystream/hydra-indexer-gateway:2.1.0-beta.5',
            //   env: [
            //     { name: 'WARTHOG_STARTER_DB_DATABASE', value: process.env.INDEXER_DB_NAME! },
            //     { name: 'WARTHOG_STARTER_DB_HOST', value: 'postgres-db' },
            //     { name: 'WARTHOG_STARTER_DB_PASSWORD', value: process.env.DB_PASS! },
            //     { name: 'WARTHOG_STARTER_DB_PORT', value: process.env.DB_PORT! },
            //     { name: 'WARTHOG_STARTER_DB_USERNAME', value: process.env.DB_USER! },
            //     { name: 'WARTHOG_STARTER_REDIS_URI', value: 'redis://redis:6379/0' },
            //     { name: 'WARTHOG_APP_PORT', value: process.env.WARTHOG_APP_PORT! },
            //     { name: 'PORT', value: process.env.WARTHOG_APP_PORT! },
            //     { name: 'DEBUG', value: '*' },
            //   ],
            //   ports: [{ containerPort: 4002 }],
            // },
            // {
            //   name: 'processor',
            //   image: joystreamAppsImage,
            //   imagePullPolicy: 'Never',
            //   env: [
            //     {
            //       name: 'INDEXER_ENDPOINT_URL',
            //       value: `http://hydra-indexer-gateway:${process.env.WARTHOG_APP_PORT}/graphql`,
            //     },
            //     { name: 'TYPEORM_HOST', value: 'postgres-db' },
            //     { name: 'TYPEORM_DATABASE', value: process.env.DB_NAME! },
            //     { name: 'DEBUG', value: 'index-builder:*' },
            //     { name: 'PROCESSOR_POLL_INTERVAL', value: '1000' },
            //   ],
            //   // volumeMounts: [
            //   //   {
            //   //     mountPath: '/joystream/query-node/mappings/lib/generated/types/typedefs.json',
            //   //     name: 'processor-volume',
            //   //   },
            //   // ],
            //   command: ['yarn', 'workspace', 'query-node-root', 'processor:start'],
            // },
            // {
            //   name: 'graphql-server',
            //   image: joystreamAppsImage,
            //   imagePullPolicy: 'Never',
            //   env: [
            //     { name: 'DB_HOST', value: 'postgres-db' },
            //     { name: 'DB_NAME', value: process.env.DB_NAME! },
            //   ],
            //   ports: [{ name: 'graph-ql-port', containerPort: Number(process.env.GRAPHQL_SERVER_PORT!) }],
            //   command: ['yarn', 'workspace', 'query-node-root', 'query-node:start:prod'],
            // },
          ],
          // volumes: [
          //   {
          //     name: 'processor-volume',
          //     hostPath: {
          //       path: '/Users/anuj/Joystream/joystream/types/augment/all/defs.json',
          //       type: 'FileOrCreate',
          //     },
          //   },
          //   {
          //     name: 'indexer-volume',
          //     hostPath: {
          //       path: '/Users/anuj/Joystream/joystream/types/augment/all/defs.json',
          //       type: 'FileOrCreate',
          //     },
          //   },
          // ],
        },
      },
    },
  }
  // {
  //   provider: cluster.provider,
  // }
)

// Export the Deployment name
export const deploymentName = deployment.metadata.name

// Create a LoadBalancer Service for the NGINX Deployment
const service = new k8s.core.v1.Service(
  name,
  {
    metadata: {
      labels: appLabels,
      namespace: namespaceName,
    },
    spec: {
      type: 'NodePort',
      ports: [
        { name: 'port-1', port: 8081, targetPort: 'graph-ql-port' },
        { name: 'port-2', port: 4000, targetPort: 4002 },
      ],
      selector: appLabels,
    },
  }
  // {
  //   provider: cluster.provider,
  // }
)

// Export the Service name and public LoadBalancer Endpoint
export const serviceName = service.metadata.name

// When "done", this will print the public IP.
export let serviceHostname: pulumi.Output<string>

serviceHostname = service.status.loadBalancer.ingress[0].hostname
