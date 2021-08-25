export interface ResolvablePromise<T> {
    promise: Promise<T>;

    resolve(value: T): void;

    reject(error: Error): void;
}

export default function createResolvablePromise<T>(): ResolvablePromise<T> {
    let resolve: ResolvablePromise<T>["resolve"];
    let reject: ResolvablePromise<T>["reject"];

    const promise = new Promise<T>((yay, nay) => {
        resolve = yay;
        reject = nay;
    });

    return {
        promise,
        resolve,
        reject
    };
}
