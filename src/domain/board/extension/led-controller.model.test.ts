import { Sequelize } from 'sequelize-typescript';
import FirmataBoardMock from '../../../mocks/firmata-board.mock';
import {Board, FirmataBoard} from '../base';
import { LedController } from './';

let board: any;
let sequelize: Sequelize;
let mockFirmataBoard;

beforeAll(() => {
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: ':memory:',
    });
    sequelize.addModels([Board]);
});

beforeEach(() => {
    board = new LedController();
    mockFirmataBoard = new FirmataBoardMock();
    board.firmataBoard = mockFirmataBoard;
});

describe('LedController:', () => {
    describe('constructor', () => {
        test('should be instantiated', () => {
            expect(board).toBeDefined();
        });

        test('should set firmataBoard serial options', () => {
            board = new LedController();

            const serialOptions = {
                portId: board.firmataBoard.SERIAL_PORT_IDs.SW_SERIAL0,
                // @ts-ignore
                baud: LedController.SERIAL_BAUD_RATE,
                rxPin: board.architecture.pinMap.RX,
                txPin: board.architecture.pinMap.TX,
            };

            expect(mockFirmataBoard.serialConfig).toHaveBeenCalledWith(serialOptions);
        });
    });

    describe('#executeAction', () => {
        test.each([
            ['SETCOLOR', [255, 255, 255], 'C'],
            ['KITT', [255, 255, 255], 'K'],
            ['PULSECOLOR', [255, 255], 'P'],
            ['RAINBOW', [], 'R'],
        ])(
            'should run correct method when running executeAction(%p, %p)',
            (action: string, parameters: number[], command: string) => {
                board.online = true;
                board.serialWriteBytes = jest.fn();

                board.executeAction(action, parameters);

                expect(board.serialWriteBytes).toHaveBeenCalledWith(FirmataBoard.SERIAL_PORT_ID.SW_SERIAL0, [
                    '[',
                    command,
                    ...parameters,
                    ']',
                ]);
            },
        );
    });

    describe('#pulseColor', () => {
        describe('happy flows', () => {
            test('should execute serialWriteBytes', () => {
                board.serialWriteBytes = jest.fn();

                board.pulseColor(255, 255);

                expect(board.serialWriteBytes).toHaveBeenCalledWith(FirmataBoard.SERIAL_PORT_ID.SW_SERIAL0, [
                    '[',
                    'P',
                    255,
                    255,
                    ']',
                ]);
            });
        });

        describe('exception flows', () => {
            test.each([[0, 256], [-1, 255], ['a', 255], [128, 'z']])(
                'should throw error when running pulseColor(%p, %p)',
                (hue: any, saturation: any) => {
                    const pulseColorError = () => {
                        board.pulseColor(hue, saturation);
                    };

                    expect(pulseColorError).toThrowError(new Error(`Parameters should be 8 bit numbers (0-255).`));
                },
            );
        });
    });

    describe('#setColor', () => {
        describe('happy flows', () => {
            test('should execute serialWriteBytes', () => {
                board.serialWriteBytes = jest.fn();

                board.setColor(255, 255, 255);

                expect(board.serialWriteBytes).toHaveBeenCalledWith(FirmataBoard.SERIAL_PORT_ID.SW_SERIAL0, [
                    '[',
                    'C',
                    255,
                    255,
                    255,
                    ']',
                ]);
            });
        });

        describe('exception flows', () => {
            test.each([[0, 256, 0], [-1, 255, 300], ['a', 255, -2], [128, 'z', 100]])(
                'should throw error when running setColor(%p, %p, %p)',
                (hue: any, saturation: any, value: any) => {
                    const setColorError = () => {
                        board.setColor(hue, saturation, value);
                    };

                    expect(setColorError).toThrowError(new Error(`Parameters should be 8 bit numbers (0-255).`));
                },
            );
        });
    });

    describe('#kitt', () => {
        describe('happy flows', () => {
            test('should execute serialWriteBytes', () => {
                board.serialWriteBytes = jest.fn();

                board.kitt(255, 255, 255);

                expect(board.serialWriteBytes).toHaveBeenCalledWith(FirmataBoard.SERIAL_PORT_ID.SW_SERIAL0, [
                    '[',
                    'K',
                    255,
                    255,
                    255,
                    ']',
                ]);
            });
        });

        describe('exception flows', () => {
            test.each([[0, 256, 0], [-1, 255, 300], ['a', 255, -2], [128, 'z', 100]])(
                'should throw error when running kitt(%p, %p, %p)',
                (hue: any, saturation: any, value: any) => {
                    const kittError = () => {
                        board.kitt(hue, saturation, value);
                    };

                    expect(kittError).toThrowError(new Error(`Parameters should be 8 bit numbers (0-255).`));
                },
            );
        });
    });

    describe('#rainbow', () => {
        describe('happy flows', () => {
            test('should execute serialWriteBytes', () => {
                board.serialWriteBytes = jest.fn();

                board.rainbow();

                expect(board.serialWriteBytes).toHaveBeenCalledWith(FirmataBoard.SERIAL_PORT_ID.SW_SERIAL0, [
                    '[',
                    'R',
                    ']',
                ]);
            });
        });
    });

    describe('#parametersAreValid', () => {
        test.each([[[255, 128, 0]], [[0, 0, 0]], [[23, 86, 10]]])(
            'should return true when running parametersAreValid(%p)',
            (parameters: any[]) => {
                // @ts-ignore
                const result = LedController.parametersAreValid(parameters);

                expect(result).toEqual(true);
            },
        );

        test.each([[[-1, 128, 0]], [[0, 256, 0]], [[23, 512, 10]], [[{}, 128, 10]], [[[], 128, 10]], [['a', 512, 10]]])(
            'should return false when running parametersAreValid(%p)',
            (parameters: any[]) => {
                // @ts-ignore
                const result = LedController.parametersAreValid(parameters);

                expect(result).toEqual(false);
            },
        );
    });
});