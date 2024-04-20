interface AsyncInterval {
    isRunning: boolean;
    id?: NodeJS.Timeout;
}
const asyncIntervals: AsyncInterval[] = [];

const runAsyncInterval = (handler: () => Promise<unknown>, intervalMillis: number, intervalIndex: number) => {
    void handler().finally(() => {
        if (asyncIntervals[intervalIndex]) {
            const timeoutHandle = setTimeout(
                () => runAsyncInterval(handler, intervalMillis, intervalIndex),
                intervalMillis,
            );
            asyncIntervals[intervalIndex].id = timeoutHandle;
        }
    });
};

export const setAsyncInterval = (handler: () => Promise<unknown>, intervalMillis: number) => {
    const intervalIndex = asyncIntervals.length;
    asyncIntervals.push({
        isRunning: true,
    });
    runAsyncInterval(handler, intervalMillis, intervalIndex);
    return intervalIndex;
};

export const clearAsyncInterval = (intervalIndex: number) => {
    if (asyncIntervals[intervalIndex]) {
        asyncIntervals[intervalIndex].isRunning = false;
        clearTimeout(asyncIntervals[intervalIndex].id);
    }
};
