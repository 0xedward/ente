import { Collection } from 'types/collection';
import { EnteFile } from 'types/file';
import { ElectronFile, FileWithCollection } from 'types/upload';
import { runningInBrowser } from 'utils/common';
import {
    getLocalCollections,
    removeFromCollection,
} from '../collectionService';
import { getLocalFiles } from '../fileService';
import { logError } from 'utils/sentry';
import { EventQueueItem, WatchMapping } from 'types/watchFolder';
import { ElectronAPIsInterface } from 'types/electron';
import debounce from 'debounce-promise';
import {
    diskFileAddedCallback,
    diskFileRemovedCallback,
    diskFolderRemovedCallback,
} from './watchFolderEventHandlers';

class watchFolderService {
    private ElectronAPIs: ElectronAPIsInterface;
    private allElectronAPIsExist: boolean = false;
    private eventQueue: EventQueueItem[] = [];
    private currentEvent: EventQueueItem;
    private trashingDirQueue: string[] = [];
    private isEventRunning: boolean = false;
    private uploadRunning: boolean = false;
    private pathToIDMap = new Map<string, number>();
    private setElectronFiles: (files: ElectronFile[]) => void;
    private setCollectionName: (collectionName: string) => void;
    private syncWithRemote: () => void;
    private showProgressView: () => void;
    private setWatchFolderServiceIsRunning: (isRunning: boolean) => void;

    constructor() {
        this.ElectronAPIs = (runningInBrowser() &&
            window['ElectronAPIs']) as ElectronAPIsInterface;
        this.allElectronAPIsExist = !!this.ElectronAPIs?.getWatchMappings;
    }

    isUploadRunning() {
        return this.uploadRunning;
    }

    async init(
        setElectronFiles: (files: ElectronFile[]) => void,
        setCollectionName: (collectionName: string) => void,
        syncWithRemote: () => void,
        setWatchFolderServiceIsRunning: (isRunning: boolean) => void
    ) {
        if (this.allElectronAPIsExist) {
            try {
                this.setElectronFiles = setElectronFiles;
                this.setCollectionName = setCollectionName;
                this.syncWithRemote = syncWithRemote;
                this.setWatchFolderServiceIsRunning =
                    setWatchFolderServiceIsRunning;

                let mappings = this.getWatchMappings();

                console.log('mappings', mappings);

                if (!mappings) {
                    return;
                }

                mappings = await this.filterOutDeletedMappings(mappings);

                for (const mapping of mappings) {
                    const filesOnDisk: ElectronFile[] =
                        await this.ElectronAPIs.getAllFilesFromDir(
                            mapping.folderPath
                        );

                    this.uploadDiffOfFiles(mapping, filesOnDisk);
                    this.trashDiffOfFiles(mapping, filesOnDisk);
                }

                this.setWatchFunctions();
                await this.runNextEvent();
            } catch (e) {
                logError(e, 'error while initializing watch service');
            }
        }
    }

    isMappingSyncing(mapping: WatchMapping) {
        return this.currentEvent?.collectionName === mapping.collectionName;
    }

    private uploadDiffOfFiles(
        mapping: WatchMapping,
        filesOnDisk: ElectronFile[]
    ) {
        const filesToUpload = filesOnDisk.filter((electronFile) => {
            return !mapping.files.find(
                (file) => file.path === electronFile.path
            );
        });

        if (filesToUpload.length > 0) {
            const event: EventQueueItem = {
                type: 'upload',
                collectionName: mapping.collectionName,
                files: filesToUpload,
            };
            this.eventQueue.push(event);
        }
    }

    private trashDiffOfFiles(
        mapping: WatchMapping,
        filesOnDisk: ElectronFile[]
    ) {
        const filesToRemove = mapping.files.filter((file) => {
            return !filesOnDisk.find(
                (electronFile) => electronFile.path === file.path
            );
        });

        if (filesToRemove.length > 0) {
            const event: EventQueueItem = {
                type: 'trash',
                collectionName: mapping.collectionName,
                paths: filesToRemove.map((file) => file.path),
            };
            this.eventQueue.push(event);
        }
    }

    private async filterOutDeletedMappings(
        mappings: WatchMapping[]
    ): Promise<WatchMapping[]> {
        const notDeletedMappings = [];
        for (const mapping of mappings) {
            const mappingExists = await this.ElectronAPIs.doesFolderExists(
                mapping.folderPath
            );
            if (mappingExists) {
                notDeletedMappings.push(mapping);
            }
        }
        this.ElectronAPIs.setWatchMappings(notDeletedMappings);
        return notDeletedMappings;
    }

    async pushEvent(event: EventQueueItem) {
        this.eventQueue.push(event);
        debounce(this.runNextEvent.bind(this), 300)();
    }

    async pushTrashedDir(path: string) {
        this.trashingDirQueue.push(path);
    }

    private setWatchFunctions() {
        if (this.allElectronAPIsExist) {
            this.ElectronAPIs.registerWatcherFunctions(
                diskFileAddedCallback,
                diskFileRemovedCallback,
                diskFolderRemovedCallback
            );
        }
    }

    async addWatchMapping(collectionName: string, folderPath: string) {
        if (this.allElectronAPIsExist) {
            try {
                await this.ElectronAPIs.addWatchMapping(
                    collectionName,
                    folderPath
                );
            } catch (e) {
                logError(e, 'error while adding watch mapping');
            }
        }
    }

    async removeWatchMapping(folderPath: string) {
        if (this.allElectronAPIsExist) {
            try {
                await this.ElectronAPIs.removeWatchMapping(folderPath);
            } catch (e) {
                logError(e, 'error while removing watch mapping');
            }
        }
    }

    getWatchMappings(): WatchMapping[] {
        if (this.allElectronAPIsExist) {
            try {
                return this.ElectronAPIs.getWatchMappings() ?? [];
            } catch (e) {
                logError(e, 'error while getting watch mappings');
                return [];
            }
        }
        return [];
    }

    private setIsEventRunning(isEventRunning: boolean) {
        this.isEventRunning = isEventRunning;
        this.setWatchFolderServiceIsRunning(isEventRunning);
    }

    private async runNextEvent() {
        console.log('runNextEvent mappings', this.getWatchMappings());

        if (this.eventQueue.length === 0 || this.isEventRunning) {
            return;
        }

        this.setIsEventRunning(true);
        const event = this.clubSameCollectionEvents();
        this.currentEvent = event;
        if (event.type === 'upload') {
            this.processUploadEvent();
        } else {
            await this.processTrashEvent();
            this.setIsEventRunning(false);
            this.runNextEvent();
        }
    }

    private async processUploadEvent() {
        try {
            this.uploadRunning = true;

            this.setCollectionName(this.currentEvent.collectionName);
            this.setElectronFiles(this.currentEvent.files);
        } catch (e) {
            logError(e, 'error while running next upload');
        }
    }

    async onFileUpload(fileWithCollection: FileWithCollection, file: EnteFile) {
        if (!this.isUploadRunning) {
            return;
        }
        if (fileWithCollection.isLivePhoto) {
            this.pathToIDMap.set(
                (fileWithCollection.livePhotoAssets.image as ElectronFile).path,
                file.id
            );
            this.pathToIDMap.set(
                (fileWithCollection.livePhotoAssets.video as ElectronFile).path,
                file.id
            );
        } else {
            this.pathToIDMap.set(
                (fileWithCollection.file as ElectronFile).path,
                file.id
            );
        }
    }

    async allFileUploadsDone(
        filesWithCollection: FileWithCollection[],
        collections: Collection[]
    ) {
        if (this.allElectronAPIsExist) {
            try {
                const collection = collections.find(
                    (collection) =>
                        collection.id === filesWithCollection[0].collectionID
                );
                if (
                    !this.isEventRunning ||
                    this.currentEvent.collectionName !== collection?.name
                ) {
                    return;
                }

                const uploadedFiles: WatchMapping['files'] = [];

                for (const fileWithCollection of filesWithCollection) {
                    this.handleUploadedFile(fileWithCollection, uploadedFiles);
                }

                if (uploadedFiles.length > 0) {
                    const mappings = this.getWatchMappings();
                    const mapping = mappings.find(
                        (mapping) =>
                            mapping.collectionName ===
                            this.currentEvent.collectionName
                    );
                    if (mapping) {
                        mapping.files = [...mapping.files, ...uploadedFiles];
                        this.ElectronAPIs.setWatchMappings(mappings);
                    }
                }

                this.runPostUploadsAction();
            } catch (e) {
                logError(e, 'error while running all file uploads done');
            }
        }
    }

    private runPostUploadsAction() {
        this.setIsEventRunning(false);
        this.uploadRunning = false;
        this.runNextEvent();
    }

    private handleUploadedFile(
        fileWithCollection: FileWithCollection,
        uploadedFiles: { path: string; id: number }[]
    ) {
        if (fileWithCollection.isLivePhoto) {
            const imagePath = (
                fileWithCollection.livePhotoAssets.image as ElectronFile
            ).path;
            const videoPath = (
                fileWithCollection.livePhotoAssets.video as ElectronFile
            ).path;

            if (
                this.pathToIDMap.has(imagePath) &&
                this.pathToIDMap.has(videoPath)
            ) {
                uploadedFiles.push({
                    path: imagePath,
                    id: this.pathToIDMap.get(imagePath),
                });
                uploadedFiles.push({
                    path: videoPath,
                    id: this.pathToIDMap.get(videoPath),
                });

                this.pathToIDMap.delete(imagePath);
                this.pathToIDMap.delete(videoPath);
            }
        } else {
            const filePath = (fileWithCollection.file as ElectronFile).path;

            if (this.pathToIDMap.has(filePath)) {
                uploadedFiles.push({
                    path: filePath,
                    id: this.pathToIDMap.get(filePath),
                });

                this.pathToIDMap.delete(filePath);
            }
        }
    }

    private async processTrashEvent() {
        try {
            if (this.checkAndIgnoreIfFileEventsFromTrashedDir()) {
                return;
            }

            const { collectionName, paths } = this.currentEvent;
            const filePathsToRemove = new Set(paths);

            const mappings = this.getWatchMappings();
            const mappingIdx = mappings.findIndex(
                (mapping) => mapping.collectionName === collectionName
            );
            if (mappingIdx === -1) {
                return;
            }

            const files = mappings[mappingIdx].files.filter((file) =>
                filePathsToRemove.has(file.path)
            );

            await this.trashByIDs(files, collectionName);

            mappings[mappingIdx].files = mappings[mappingIdx].files.filter(
                (file) => !filePathsToRemove.has(file.path)
            );
            this.ElectronAPIs.setWatchMappings(mappings);
        } catch (e) {
            logError(e, 'error while running next trash');
        }
    }

    private async trashByIDs(
        toTrashFiles: WatchMapping['files'],
        collectionName: string
    ) {
        try {
            const collections = await getLocalCollections();
            const collection = collections.find(
                (collection) => collection.name === collectionName
            );
            if (!collection) {
                return;
            }
            const files = await getLocalFiles();

            const idSet = new Set<number>();
            for (const file of toTrashFiles) {
                idSet.add(file.id);
            }

            const filesToTrash = files.filter((file) => {
                return (
                    idSet.has(file.id) && file.collectionID === collection.id
                );
            });

            await removeFromCollection(collection.id, filesToTrash);
            this.syncWithRemote();
        } catch (e) {
            logError(e, 'error while trashing by IDs');
        }
    }

    private checkAndIgnoreIfFileEventsFromTrashedDir() {
        if (this.trashingDirQueue.length !== 0) {
            this.ignoreFileEventsFromTrashedDir(this.trashingDirQueue[0]);
            this.trashingDirQueue.shift();
            return true;
        }
        return false;
    }

    private ignoreFileEventsFromTrashedDir(trashingDir: string) {
        this.eventQueue = this.eventQueue.filter((event) =>
            event.paths.every((path) => !path.startsWith(trashingDir))
        );
    }

    async getCollectionName(filePath: string) {
        try {
            const mappings = this.getWatchMappings();

            const collectionName = mappings.find((mapping) =>
                filePath.startsWith(mapping.folderPath + '/')
            )?.collectionName;

            if (!collectionName) {
                return null;
            }

            return collectionName;
        } catch (e) {
            logError(e, 'error while getting collection name');
        }
    }

    async selectFolder(): Promise<string> {
        try {
            const folderPath = await this.ElectronAPIs.selectRootDirectory();
            return folderPath;
        } catch (e) {
            logError(e, 'error while selecting folder');
        }
    }

    // Batches all the files to be uploaded (or trashed) from the
    // event queue of same collection as the next event
    private clubSameCollectionEvents(): EventQueueItem {
        const event = this.eventQueue.shift();
        while (
            this.eventQueue.length > 0 &&
            event.collectionName === this.eventQueue[0].collectionName &&
            event.type === this.eventQueue[0].type
        ) {
            if (event.type === 'trash') {
                event.paths = [...event.paths, ...this.eventQueue[0].paths];
            } else {
                event.files = [...event.files, ...this.eventQueue[0].files];
            }
            this.eventQueue.shift();
        }
        return event;
    }

    async isFolder(folderPath: string) {
        try {
            const isFolder = await this.ElectronAPIs.doesFolderExists(
                folderPath
            );
            return isFolder;
        } catch (e) {
            logError(e, 'error while checking if folder exists');
        }
    }
}

export default new watchFolderService();
