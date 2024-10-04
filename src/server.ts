import * as grpc from "@grpc/grpc-js"
import * as protoLoader from "@grpc/proto-loader"
import { Server as GrpcServer, ServerCredentials } from "@grpc/grpc-js"
import path from "path"

const PROTO_PATH = path.resolve(__dirname, "../protos/pubsub.proto")

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
})

const proto = grpc.loadPackageDefinition(packageDefinition) as any

const topics: Map<string, Set<(message: string) => void>> = new Map()

const publish = (call: any, callback: any) => {
  const { topic, message } = call.request

  if (!topics.has(topic)) {
    topics.set(topic, new Set())
  }

  topics.get(topic)?.forEach((subscriberCallback) => {
    subscriberCallback(message)
  })

  console.log(`Published message to topic ${topic}: ${message}`)
  callback(null, {})
}

const subscribe = (call: any) => {
  const { topic } = call.request
  console.log(`Subscribed to topic: ${topic}`)

  if (!topics.has(topic)) {
    topics.set(topic, new Set())
  }

  const subscriberCallback = (message: string) => {
    call.write({ message })
  }

  topics.get(topic)?.add(subscriberCallback)

  call.on("cancelled", () => {
    console.log(`Unsubscribed from topic: ${topic}`)
    topics.get(topic)?.delete(subscriberCallback)
  })
}

export class Server {
  private server: GrpcServer

  constructor(port: number) {
    this.server = new GrpcServer()
    this.server.addService(proto.pubsub.PubSubService.service, {
      publish,
      subscribe,
    })

    this.server.bindAsync(
      `0.0.0.0:${port}`,
      ServerCredentials.createInsecure(),
      (error, _port) => {
        if (error) {
          console.error("Failed to bind server:", error)
          return
        }

        console.log(`Server running at http://0.0.0.0:${port}`)
      }
    )
  }
}