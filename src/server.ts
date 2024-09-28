import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Server as GrpcServer, ServerCredentials } from '@grpc/grpc-js';

const PROTO_PATH = './pubsub.proto';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition) as any;

const topics: Map<string, Set<(message: string) => void>> = new Map();

const publish = (call: any, callback: any) => {
    const { topic, message } = call.request;
    if (topics.has(topic)) {
        topics.get(topic)?.forEach(callback => callback(message));
    }
    callback(null, {});
};

const subscribe = (call: any) => {
    const { topic } = call.request;

    if (!topics.has(topic)) {
        topics.set(topic, new Set());
    }

    const subscriberCallback = (message: string) => {
        call.write({ message });
    };

    topics.get(topic)?.add(subscriberCallback);

    call.on('cancelled', () => {
        topics.get(topic)?.delete(subscriberCallback);
    });
};

export class Server {
    private server: GrpcServer;

    constructor(port: number) {
        this.server = new GrpcServer();
        this.server.addService(proto.pubsub.PubSubService.service, { publish, subscribe });

        this.server.bindAsync(`127.0.0.1:${port}`, ServerCredentials.createInsecure(), (error, _port) => {
            if (error) {
                console.error('Failed to bind server:', error);
                return;
            }

            console.log(`Server running at http://127.0.0.1:${port}`);
        });
    }
}
