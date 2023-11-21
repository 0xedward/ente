export const CustomErrors = {
    WINDOWS_NATIVE_IMAGE_PROCESSING_NOT_SUPPORTED:
        'Windows native image processing is not supported',
    INVALID_OS: (os: string) => `Invalid OS - ${os}`,
    WAIT_TIME_EXCEEDED: 'Wait time exceeded',
    UNSUPPORTED_PLATFORM: (platform: string, arch: string) =>
        `Unsupported platform - ${platform} ${arch}`,
};
