export default class promise_register {
    private promises;
    /**
     * resolve the registered promise specified by an id
     *
     * @param id id of the promise to resolve
     * @param args arguments to resolve with
     */
    resolve(id: string, ...args: any[]): void;
    /**
     * reject the registered promise specified by an id
     *
     * @param id id of the promise to reject
     * @param args arguments to reject with
     */
    reject(id: string, ...args: any[]): void;
    /**
     * reject all promises
     *
     * @param args arguments to reject with
     */
    reject_all(...reason: any[]): void;
    /**
     * create a new promise under the specified id
     * @param id id of the new promise
     *
     * @returns the new promise
     */
    new_promise(id: string): Promise<any>;
}
