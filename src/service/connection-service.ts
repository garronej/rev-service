import Boards from "../model/boards";
import * as FirmataBoard from 'firmata';
import Logger from "./logger";
import * as net from "net";
import IBoard from "../interface/board";

/**
 * A service that implements method(s) to connect to devices compatible with the firmata protocol.
 *
 * @namespace ConnectionService
 */
class ConnectionService {
    /**
     * Local instance of {#link Boards}.
     *
     * @access private
     * @type {Boards}
     */
    protected model: Boards;

    /**
     * Namespace used by the local instance of {@link Logger}
     *
     * @access protected
     * @type {string}
     */
    protected namespace = 'ConnectionService';

    /**
     * Local instance of the {@link Logger} class.
     *
     * @access protected
     * @type {Logger}
     */
    protected log: Logger;

    /**
     * @constructor
     * @param {Boards} model - Data model.
     */
    constructor( model: Boards ) {
        this.model = model;

        this.log = new Logger( this.namespace )
    }

    /**
     * Sets up a connection to a board.
     *
     * @param {net.Socket} port - An EtherPort object or serial port address
     * @param {function(IBoard):void} [connected] - Callback for when device successfully connects, containing an object implementing the {@link IBoard} interface.
     * @param {function(IBoard):void} [disconnected] - Callback when device disconnects containing an object implementing the {@link IBoard} interface.
     */
    protected connectToBoard( port: net.Socket | string, connected?: ( board: IBoard ) => void, disconnected?: ( board?: IBoard ) => void ): void {
        let connectedBoard: IBoard;
        let id: string;

        let firmataBoard = new FirmataBoard( port );

        /*
         * Set a 10 second timeout.
         * The device is deemed unsupported if a connection could not be made within that period.
         */
        const connectionTimeout = setTimeout( () => {
            this.log.warn( 'Timeout while connecting to connectedBoard.' );

            connectedBoard = null;
            firmataBoard.removeAllListeners();
            firmataBoard = null;

            disconnected();
        }, 10000);

        const connectionEstablished = async () => {
            clearTimeout( connectionTimeout );

            /*
             * The type and ID are defined by the name of the Arduino sketch file.
             * For now the following devices have a tailor made class:
             * - Major Tom ( MajorTom_<unique_identifier>.ino )
             */
            const type = firmataBoard.firmware.name.split( '_' ).shift();
            id = firmataBoard.firmware.name.split( '_' ).pop().replace( '.ino', '' );

            // add connected device to list of available devices and / or persist to the data storage if new
            connectedBoard = await this.model.addBoard( id, type, firmataBoard );

            // callback to connection interface service
            connected( connectedBoard );
        };

        firmataBoard.on( 'ready', connectionEstablished.bind(this) );

        firmataBoard.on( 'error', ( err ) => {
            disconnected( connectedBoard );
            connectedBoard = null;
        } );

        firmataBoard.on( 'update', ( boardUpdates: IBoard ) => {
            this.model.updateBoard( boardUpdates );
        } );

        firmataBoard.once( 'disconnect', () => {
            this.log.debug( 'Disconnect event received from firmataboard.' );
            connectedBoard = null;
            disconnected( connectedBoard );
            this.model.disconnectBoard( id );
        } );
    }
}

export default ConnectionService;