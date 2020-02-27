import { Board, IDLE } from './board.model';
import {BoardArchitecture, SUPPORTED_ARCHITECTURES} from './board-architecture.model';
import {
    BoardIncompatibleError,
    BoardPinNotFoundError,
    BoardUnavailableError,
    InvalidArgumentError,
} from '../../error';
// import {FirmataBoard} from './firmata-board.model';
import {firmataBoardMock} from "./__mocks__/firmata-board.model";
import {prepareOptions, Sequelize} from "sequelize-typescript";
import {PIN_STATE} from "./firmata-board.model";
jest.mock('./firmata-board.model');

let board: Board;

const properties = {
    firmataBoard: 'firmataBoard',
    clearAllIntervals: 'clearAllIntervals',
    clearAllTimeouts: 'clearAllTimeouts',
    clearListeners: 'clearListeners',
    emitUpdate: 'emitUpdate',
    clearHeartbeatTimeout: 'clearHeartbeatTimeout',
    intervals: 'intervals',
    clearInterval: 'clearInterval',
    timeouts: 'timeouts',
    clearTimeout: 'clearTimeout',
    toggleLED: 'toggleLED',
    setBlinkLEDEnabled: 'setBlinkLEDEnabled',
    blinkInterval: 'blinkInterval',
    setPinValue: 'setPinValue',
    startHeartbeat: 'startHeartbeat',
    heartbeatInterval: 'heartbeatInterval',
};

beforeAll(() => {
    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: ':memory:',
    });
    sequelize.addModels([Board]);
});

beforeEach(() => {
    board = new Board();
    board[properties.firmataBoard] = firmataBoardMock;
});

describe('Board', () => {
    describe('constructor', () => {
        test('is instantiated', () => {
            expect(board).toBeDefined();
        });
    });

    describe('#getAvailableActions', () => {
        test('should return correct available actions', () => {
            const availableActions = board.getAvailableActions();

            expect(availableActions).toBeDefined();
            expect(Array.isArray(availableActions)).toBeTruthy();
            expect(availableActions[0].name).toBe('BLINKON');
            expect(availableActions[1].name).toBe('BLINKOFF');
            expect(availableActions[2].name).toBe('TOGGLELED');
            expect(availableActions[3].name).toBe('SETPINVALUE');
            expect(availableActions[0].requiresParams).toBeFalsy();
            expect(availableActions[1].requiresParams).toBeFalsy();
            expect(availableActions[2].requiresParams).toBeFalsy();
            expect(availableActions[3].requiresParams).toBeTruthy();
        });
    });

    describe('#setArchitecture', () => {
        describe('happy flows', () => {
            test('should set board architecture to ESP8266', () => {
                board.setArchitecture(SUPPORTED_ARCHITECTURES.ESP_8266);

                expect(board.architecture.pinMap.LED).toEqual(2);
                expect(board.architecture.pinMap.RX).toEqual(3);
                expect(board.architecture.pinMap.TX).toEqual(1);
                expect(board.architecture.name).toEqual(SUPPORTED_ARCHITECTURES.ESP_8266.name);
            });

            test('should set board architecture to Arduino Uno', () => {
                board.setArchitecture(SUPPORTED_ARCHITECTURES.ARDUINO_UNO);

                expect(board.architecture.pinMap.LED).toEqual(13);
                expect(board.architecture.pinMap.RX).toEqual(1);
                expect(board.architecture.pinMap.TX).toEqual(0);
                expect(board.architecture.name).toEqual(SUPPORTED_ARCHITECTURES.ARDUINO_UNO.name);
            });
        });

        describe('exception flows', () => {
            test('should throw an error when setting unsupported architecture', () => {
                const unsupportedArchitecture = new BoardArchitecture('Bacon', {LED: 13, RX: 1, TX: 0});
                const setArchitectureError = () => {
                    board.setArchitecture(unsupportedArchitecture);
                };

                expect(setArchitectureError).toThrowError(new Error('This architecture is not supported.'));
            });
        });
    });

    describe('#setIdle', () => {
        test('should set current program to IDLE', () => {
            board.setIdle();

            expect(board.currentProgram).toBe(IDLE);
        });
    });

    describe('#getFirmataBoard', () => {
        test('should return mock firmataboard object', () => {
            const result = board.getFirmataBoard();

            expect(result).toEqual(firmataBoardMock);
        });
    });

    describe('#toDiscrete', () => {
        describe('happy flows', () => {
            test('should return object with all the required properties', () => {
                const discreteBoard = board.toDiscrete();

                const requiredProperties = [
                    'id',
                    'name',
                    'vendorId',
                    'productId',
                    'type',
                    'currentProgram',
                    'online',
                    'lastUpdateReceived',
                    'architecture',
                    'availableActions',
                    'pins',

                    // optional. only when supplied board parameter has firmataBoard property
                    'refreshRate',
                ];

                expect(discreteBoard).toBeDefined();

                requiredProperties.forEach(property => {
                    expect(property in discreteBoard).toEqual(true);
                });
            });

            test('should return object without refreshRate property', () => {
                board[properties.firmataBoard] = undefined;
                const discreteBoard = board.toDiscrete();

                expect(discreteBoard).toBeDefined();
                expect('refreshRate' in discreteBoard).toEqual(false);
            });
        });
    });

    describe('#toDiscreteArray', () => {
        describe('happy flows', () => {
            test('should return array of objects reflecting IBoard interface', () => {
                const discreteBoardArray = Board.toDiscreteArray([board]);

                expect(Array.isArray(discreteBoardArray)).toBeTruthy();
            });
        });
    });

    describe('#executeAction', () => {
        describe('happy flows', () => {
            test.each([
                ['TOGGLELED', 'toggleLED', []],
                ['BLINKON', 'setBlinkLEDEnabled', [true]],
                ['BLINKOFF', 'setBlinkLEDEnabled', [false]],
                ['SETPINVALUE', 'setPinValue', [0, 128]],
            ])(
                'should run %s method and emit update when running executeAction(%p, %p)',
                (action: string, method: string, parameters: any[]) => {
                    spyOn(board[properties.firmataBoard].update, 'post');
                    spyOn<any>(board, method);
                    board.online = true;

                    board.executeAction(action, parameters);

                    expect(board[method]).toHaveBeenCalledWith(...parameters);
                    expect(board[properties.firmataBoard].update.post).toHaveBeenCalled();
                },
            );
        });

        describe('exception flows', () => {
            test('should throw error when board not online', () => {
                const executeAction = () => {
                    board.executeAction('TOGGLELED');
                };

                expect(executeAction).toThrowError(
                    new BoardUnavailableError(`Unable to execute action on this board since it is not online.`),
                );
            });

            // unavailable method should throw error when running executeAction method
            test.each([
                ['bacon', new BoardIncompatibleError(`'bacon' is not a valid action for this board.`)],
                [1337, new BoardIncompatibleError(`'1337' is not a valid action for this board.`)],
            ])('should should throw error when running executeAction(%p)', (invalidAction: any, error: Error) => {
                const executeAction = () => {
                    board.executeAction(invalidAction);
                };

                board.online = true;

                expect(executeAction).toThrowError(error);
            });

            test('should throw error when board not online', () => {
                const executeAction = () => {
                    board.executeAction('TOGGLELED');
                };

                expect(executeAction).toThrowError(
                    new BoardUnavailableError(`Unable to execute action on this board since it is not online.`),
                );
            });

            test('should should throw error when action not valid', () => {
                const executeAction = () => {
                    board.executeAction('bacon');
                };

                board.online = true;

                expect(executeAction).toThrowError(
                    new BoardIncompatibleError(`'bacon' is not a valid action for this board.`),
                );
            });
        });
    });

    describe('#disconnect', () => {
        test('should disconnect the board and clear listeners', () => {
            board.online = true;
            const removeAllListenersSpy = spyOn(board[properties.firmataBoard], 'removeAllListeners');
            spyOn(board, 'clearAllTimers');
            board.disconnect();

            expect(removeAllListenersSpy).toHaveBeenCalled();
            expect(board.clearAllTimers).toHaveBeenCalled();
            expect(board.online).toEqual(false);
            expect(board.getFirmataBoard()).toBeUndefined();
        });
    });

    describe('#clearAllTimers', () => {
        test('should clear all timers and intervals', () => {
            const clearAllIntervalsSpy = spyOn<any>(board, 'clearAllIntervals');
            const clearAllTimeoutsSpy = spyOn<any>(board, 'clearAllTimeouts');
            const clearListenersSpy = spyOn<any>(board, 'clearListeners');

            board.clearAllTimers();

            expect(clearAllIntervalsSpy).toHaveBeenCalled();
            expect(clearAllTimeoutsSpy).toHaveBeenCalled();
            expect(clearListenersSpy).toHaveBeenCalled();
        });
    });

    describe('#clearListeners', () => {
        test('should remove all listeners from pins and firmataBoard', () => {
            const removeListenerSpy = spyOn(board[properties.firmataBoard], 'removeListener');

            board.clearListeners();

            expect(removeListenerSpy).toHaveBeenCalledTimes(3);
            expect(removeListenerSpy.calls.argsFor(0)).toEqual(['digital-read-1', board[properties.emitUpdate]]);
            expect(removeListenerSpy.calls.argsFor(1)).toEqual(['analog-read-0', board[properties.emitUpdate]]);
            expect(removeListenerSpy.calls.argsFor(2)).toEqual(['queryfirmware', board[properties.clearHeartbeatTimeout]]);
        });
    });

    describe('#clearInterval', () => {
        describe('happy flows', () => {
            test('should clear the supplied interval', () => {
                const spy = spyOn(global, 'clearInterval');
                const interval = setInterval(jest.fn(), 1000);
                board[properties.intervals] = [interval];

                board[properties.clearInterval](interval);

                expect(spy).toHaveBeenCalledWith(interval);
                expect(board[properties.intervals].length).toEqual(0);
            });
        });
    });

    describe('#clearTimeout', () => {
        describe('happy flows', () => {
            test('should clear the supplied timeout', () => {
                const spy = spyOn(global, 'clearTimeout');
                const timeout = setTimeout(jest.fn(), 1000);
                board[properties.timeouts] = [timeout];

                board[properties.clearTimeout](timeout);

                expect(spy).toHaveBeenCalledWith(timeout);
                expect(board[properties.timeouts].length).toEqual(0);
            });
        });
    });

    describe('#setBlinkLEDEnabled', () => {
        beforeAll(() => {
            jest.useFakeTimers();
        });

        afterAll(() => {
            jest.useRealTimers();
        });

        describe('happy flows', () => {
            test('should execute toggleLED twice', () => {
                const toggleLEDSpy = spyOn<any>(board, 'toggleLED');
                const setIntervalSpy = spyOn<any>(global, 'setInterval').and.callThrough();

                board[properties.setBlinkLEDEnabled](true);

                expect(setIntervalSpy).toHaveBeenCalledWith(board[properties.toggleLED], 500);
                expect(board[properties.blinkInterval]).toBeDefined();
                expect(board[properties.intervals].length).toEqual(1);

                jest.advanceTimersByTime(1000);

                expect(toggleLEDSpy).toHaveBeenCalledTimes(2);
            });

            test('should stop blinking the LED', () => {
                board[properties.toggleLED] = jest.fn();
                board[properties.setBlinkLEDEnabled](true);

                board[properties.setBlinkLEDEnabled](false);

                expect(board[properties.blinkInterval]).toBeUndefined();
                expect(board[properties.intervals].length).toEqual(0);
            });
        });

        describe('exception flows', () => {
            test('should throw an error when already blinking the LED', () => {
                board[properties.toggleLED] = jest.fn();
                board[properties.blinkInterval] = 1;

                const blinkLed = () => {
                    board[properties.setBlinkLEDEnabled](true);
                };

                expect(blinkLed).toThrowError(new BoardUnavailableError(`LED blink is already enabled.`));
            });
        });
    });

    describe('#toggleLED', () => {
        test('should set the value of the LED pin to HIGH when initial value is LOW', () => {
            board.architecture.pinMap.LED = 1;
            board[properties.setPinValue] = jest.fn();

            board[properties.toggleLED]();

            expect(board[properties.setPinValue]).toHaveBeenCalledWith(board.architecture.pinMap.LED, PIN_STATE.HIGH);
        });

        test('should set the value of the LED pin to LOW when initial value is HIGH', () => {
            const setPinValueSpy = spyOn<any>(board, 'setPinValue');
            board[properties.firmataBoard].pins[1].value = 1; // set digital pin to state HIGH

            board.architecture.pinMap.LED = 1;

            board[properties.toggleLED]();

            expect(setPinValueSpy).toHaveBeenCalledWith(board.architecture.pinMap.LED, PIN_STATE.LOW);
        });
    });

    // describe('#startHeartbeat', () => {
    //     beforeAll(() => {
    //         jest.useFakeTimers();
    //     });
    //
    //     afterAll(() => {
    //         jest.useRealTimers();
    //     });
    //
    //     describe('happy flows', () => {
    //         test('should set a heartbeat interval', () => {
    //             board[properties.startHeartbeat]();
    //
    //             jest.advanceTimersByTime(Board[properties.heartbeatInterval]);
    //
    //             expect(setInterval).toHaveBeenCalled();
    //             expect(board[properties.intervals].length).toEqual(1);
    //         });
    //
    //         test('should set a heartbeat timeout', () => {
    //             board[properties.startHeartbeat]();
    //
    //             jest.advanceTimersByTime(Board[properties.heartbeatInterval]);
    //
    //             expect(board.heartbeatTimeout).toBeDefined();
    //         });
    //
    //         test('shouldn't timeout if the board replies on time', () => {
    //             const numheartbeats = 2;
    //
    //             board.startHeartbeat();
    //
    //             // @ts-ignore
    //             jest.advanceTimersByTime(Board.heartbeatInterval * numheartbeats);
    //
    //             expect(board.firmataBoard.queryFirmware).toHaveBeenCalledTimes(numheartbeats);
    //         });
    //     });
    //
    //     describe('exception flows', () => {
    //         test('should timeout if no response is received within 10 seconds', () => {
    //             board.firmataBoard.queryFirmware = jest.fn(callback =>
    //                 // @ts-ignore
    //                 setTimeout(callback, Board.disconnectTimeout + 1000),
    //             );
    //
    //             board.startHeartbeat();
    //
    //             // @ts-ignore
    //             jest.advanceTimersByTime(Board.heartbeatInterval + Board.disconnectTimeout + 100);
    //
    //             expect(board.heartbeatTimeout).toBeUndefined();
    //             expect(board.firmataBoard.emit).toHaveBeenCalledWith('disconnect');
    //         });
    //     });
    // });
    //
    // describe('#clearHeartbeatTimeout', () => {
    //     test('should clear the heartbeat timeout', () => {
    //         board.heartbeatTimeout = setTimeout(() => {});
    //         board.timeouts.push(board.heartbeatTimeout);
    //
    //         board.clearHeartbeatTimeout();
    //
    //         expect(board.heartbeatTimeout).toBeUndefined();
    //         expect(board.timeouts.length).toEqual(0);
    //     });
    // });
    //
    // // fixme this fails if I use bytes, why? numbers should also be converted to bytes, shouldn't they? Returned value is [1, 3, 3, 7]
    // describe('#serialWriteBytes', () => {
    //     describe('happy flows', () => {
    //         test('should write an array of numbers converted to bytes to a serial port', () => {
    //             board.serialWriteBytes(FirmataBoard.SERIAL_PORT_ID.SW_SERIAL0, ['h', 1, 3, 3, 7]);
    //
    //             expect(board.firmataBoard.serialWrite).toHaveBeenCalledWith(FirmataBoard.SERIAL_PORT_ID.SW_SERIAL0, [
    //                 104,
    //                 1,
    //                 3,
    //                 3,
    //                 7,
    //             ]);
    //         });
    //
    //         test('should write an array of characters converted to bytes to a serial port', () => {
    //             board.serialWriteBytes(FirmataBoard.SERIAL_PORT_ID.SW_SERIAL0, ['h', 'e', 'l', 'l', 'o']);
    //
    //             expect(board.firmataBoard.serialWrite).toHaveBeenCalledWith(FirmataBoard.SERIAL_PORT_ID.SW_SERIAL0, [
    //                 104,
    //                 101,
    //                 108,
    //                 108,
    //                 111,
    //             ]);
    //         });
    //     });
    //
    //     describe('exception flows', () => {
    //         test('should throw TypeError', () => {
    //             const serialWriteBytesError = () => {
    //                 board.serialWriteBytes(FirmataBoard.SERIAL_PORT_ID.SW_SERIAL0, [{}, {}]);
    //             };
    //
    //             expect(serialWriteBytesError).toThrowError(
    //                 new InvalidArgumentError(`Expected string or number. Received object.`),
    //             );
    //         });
    //     });
    // });
    //
    // describe('#emitUpdate', () => {
    //     test('should emit an update event containing a discrete copy of the board instance', () => {
    //         board.emitUpdate();
    //
    //         expect(board.firmataBoard.emit).toHaveBeenCalledWith('update', board.toDiscrete());
    //     });
    // });
    //
    // describe('#setPinValue', () => {
    //     describe('happy flows', () => {
    //         test('should call analogWrite when supplied with an analog pin', () => {
    //             const value = 128;
    //             const pin = 0;
    //             board.emitUpdate = jest.fn();
    //
    //             board.setPinValue(pin, value);
    //
    //             expect(board.firmataBoard.analogWrite).toHaveBeenCalledWith(pin, value);
    //             expect(board.emitUpdate).toHaveBeenCalled();
    //         });
    //
    //         test('should call digitalWrite when supplied with a digital pin', () => {
    //             const value = 1;
    //             const pin = 1;
    //             board.emitUpdate = jest.fn();
    //
    //             board.setPinValue(pin, value);
    //
    //             expect(board.firmataBoard.digitalWrite).toHaveBeenCalledWith(pin, value);
    //             expect(board.emitUpdate).toHaveBeenCalled();
    //         });
    //     });
    //
    //     describe('exception flows', () => {
    //         test('should throw an error if non existent pin is supplied', () => {
    //             const value = 1;
    //             const pin = 1337;
    //
    //             const setPinValue = () => {
    //                 board.setPinValue(pin, value);
    //             };
    //
    //             expect(setPinValue).toThrowError(
    //                 new BoardPinNotFoundError(`Attempted to set value of unknown pin ${pin}.`),
    //             );
    //         });
    //
    //         test.each([
    //             [
    //                 0,
    //                 -20,
    //                 new InvalidArgumentError(
    //                     `Attempted to write value -20 to analog pin 0. Only values between or equal to 0 and 1023 are allowed.`,
    //                 ),
    //             ],
    //             [
    //                 0,
    //                 2000,
    //                 new InvalidArgumentError(
    //                     `Attempted to write value 2000 to analog pin 0. Only values between or equal to 0 and 1023 are allowed.`,
    //                 ),
    //             ],
    //             [
    //                 1,
    //                 2,
    //                 new InvalidArgumentError(
    //                     `Attempted to write value 2 to digital pin 1. Only values 1 (HIGH) or 0 (LOW) are allowed.`,
    //                 ),
    //             ],
    //         ])(
    //             'should throw an error when running setPinValue(%p, %p)',
    //             (pin: number, value: number, expectedError: Error) => {
    //                 const setPinValue = () => {
    //                     board.setPinValue(pin, value);
    //                 };
    //
    //                 expect(setPinValue).toThrowError(expectedError);
    //             },
    //         );
    //     });
    // });
    //
    // describe('#attachDigitalPinListeners', () => {
    //     test('should attach listeners to all digital pins', () => {
    //         const pin = 1;
    //
    //         board.attachDigitalPinListeners();
    //
    //         expect(board.firmataBoard.digitalRead).toHaveBeenCalledTimes(1);
    //         expect(board.firmataBoard.digitalRead).toHaveBeenCalledWith(pin, board.emitUpdate);
    //     });
    // });
    //
    // describe('#attachAnalogPinListeners', () => {
    //     test('should attach listeners to all analog pins', () => {
    //         const pin = 0;
    //
    //         board.attachAnalogPinListeners();
    //
    //         expect(board.firmataBoard.analogRead).toHaveBeenCalledTimes(1);
    //         expect(board.firmataBoard.analogRead).toHaveBeenCalledWith(pin, board.emitUpdate);
    //     });
    // });
    //
    // describe('#compareAnalogReadout', () => {
    //     test('should update the previous analog value', () => {
    //         board.emitUpdate = jest.fn();
    //         const pin = 0;
    //         const value = 700;
    //
    //         board.compareAnalogReadout(pin, value);
    //
    //         expect(board.previousAnalogValue[pin]).toEqual(value);
    //         expect(board.emitUpdate).toHaveBeenCalledTimes(1);
    //     });
    //
    //     test('should retain the previous analog value', () => {
    //         board.emitUpdate = jest.fn();
    //         const pin = 0;
    //         const value = 512;
    //
    //         board.compareAnalogReadout(pin, value);
    //         board.compareAnalogReadout(pin, value);
    //
    //         expect(board.previousAnalogValue[pin]).toEqual(value);
    //         expect(board.emitUpdate).toHaveBeenCalledTimes(1);
    //     });
    // });
    //
    // describe('#clearAllIntervals', () => {
    //     test('should clear all intervals', () => {
    //         board.intervals.push(setInterval(() => {}, 1000));
    //         board.clearAllIntervals();
    //
    //         expect(board.intervals.length).toEqual(0);
    //     });
    // });
    //
    // describe('#clearAllTimeouts', () => {
    //     test('should clear all timeouts', () => {
    //         board.timeouts.push(setTimeout(() => {}, 1000));
    //         board.clearAllTimeouts();
    //
    //         expect(board.timeouts.length).toEqual(0);
    //     });
    // });
    //
    // describe('#isAvailableAction', () => {
    //     test('should return true if action is available', () => {
    //         expect(board.isAvailableAction('TOGGLELED')).toEqual(true);
    //     });
    //
    //     test('should return false if action is not available', () => {
    //         expect(board.isAvailableAction('bacon')).toEqual(false);
    //     });
    // });
    //
    // describe('#isDigitalPin', () => {
    //     test('should return true when a digital pin's index is passed in', () => {
    //         const pinIndex = 1;
    //
    //         expect(board.isDigitalPin(pinIndex)).toEqual(true);
    //     });
    //
    //     test('should return false when an analog pin's index is passed in', () => {
    //         const pinIndex = 0;
    //
    //         expect(board.isDigitalPin(pinIndex)).toEqual(false);
    //     });
    // });
    //
    // describe('#isAnalogPin', () => {
    //     test('should return true when an analog pin's index is passed in', () => {
    //         const pinIndex = 0;
    //
    //         expect(board.isAnalogPin(pinIndex)).toEqual(true);
    //     });
    //
    //     test('should return false when a digital pin's index is passed in', () => {
    //         const pinIndex = 1;
    //
    //         expect(board.isAnalogPin(pinIndex)).toEqual(false);
    //     });
    // });
    //
    // describe('#is8BitNumber', () => {
    //     test.each([[0], [32], [64], [128], [255]])(
    //         'should return true when running is8BitNumber(%p)',
    //         (value: number) => {
    //             // @ts-ignore
    //             const result = Board.is8BitNumber(value);
    //
    //             expect(result).toEqual(true);
    //         },
    //     );
    //
    //     test.each([[-1], ['0'], ['a'], [268], [{}], [[]]])(
    //         'should return false when running is8BitNumber(%p)',
    //         (value: any) => {
    //             // @ts-ignore
    //             const result = Board.is8BitNumber(value);
    //
    //             expect(result).toEqual(false);
    //         },
    //     );
    // });
    //
    // describe('#setIsSerialConnection', () => {
    //     test.each([[200, true], [1000, false]])(
    //         'should set the samplingInterval to %pms',
    //         (interval: number, isSerial: boolean) => {
    //             board.setIsSerialConnection(isSerial);
    //
    //             expect(board.firmataBoard.setSamplingInterval).toHaveBeenCalledWith(interval);
    //         },
    //     );
    // });
});