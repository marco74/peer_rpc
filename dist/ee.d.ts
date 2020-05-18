export declare type genericfunction = (...args: any[]) => void | any;
export default class eventemitter {
    private callbacks;
    on(eventname: string, f: genericfunction): void;
    off(eventname: string, f: genericfunction): void;
    emit(eventname: string, ...args: any[]): void;
}
