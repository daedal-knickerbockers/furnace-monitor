import log from "loglevel";
import { Specification, TcpConnection } from "resol-vbus";
import { ResolSensorConfig } from "../Config";

export class ResolSensor {
    private readonly connection: TcpConnection;
    private connectPromise: Promise<void> | null = null;
    private readonly specification: Specification;

    public constructor(private readonly config: ResolSensorConfig) {
        this.connection = new TcpConnection({
            host: this.config.host,
            password: this.config.password,
        });

        this.specification = Specification.getDefaultSpecification();
    }

    public async init(): Promise<void> {
        this.connectPromise = this.connection.connect();
    }

    public async onPacket(packet: Buffer): Promise<void> {
        const packetFields = this.specification.getPacketFieldsForHeaders([packet]);
        log.debug(packetFields);
    }
}
