import {
    MLSyncContext,
    MLSyncFileContext,
    DetectedObject,
    ThingClass,
} from 'types/machineLearning';
import {
    isDifferentOrOld,
    getObjectId,
    getAllThingsFromMap,
} from 'utils/machineLearning';
import mlIDbStorage from 'utils/storage/mlIDbStorage';
import ReaderService from './readerService';

class ObjectService {
    async syncFileObjectDetections(
        syncContext: MLSyncContext,
        fileContext: MLSyncFileContext
    ) {
        const { oldMlFile, newMlFile } = fileContext;
        if (
            !isDifferentOrOld(
                oldMlFile?.objectDetectionMethod,
                syncContext.objectDetectionService.method
            ) &&
            oldMlFile?.imageSource === syncContext.config.imageSource
        ) {
            newMlFile.things = oldMlFile?.things;
            newMlFile.imageSource = oldMlFile.imageSource;
            newMlFile.imageDimensions = oldMlFile.imageDimensions;
            newMlFile.objectDetectionMethod = oldMlFile.objectDetectionMethod;
            return;
        }

        newMlFile.objectDetectionMethod =
            syncContext.objectDetectionService.method;
        fileContext.newDetection = true;
        const imageBitmap = await ReaderService.getImageBitmap(
            syncContext,
            fileContext
        );
        const objectDetections =
            await syncContext.objectDetectionService.detectObjects(imageBitmap);
        // console.log('3 TF Memory stats: ', tf.memory());
        // TODO: reenable faces filtering based on width
        const detectedObjects = objectDetections?.map((detection) => {
            return {
                fileID: fileContext.enteFile.id,
                detection,
            } as DetectedObject;
        });
        newMlFile.things = detectedObjects?.map((detectedObject) => ({
            ...detectedObject,
            id: getObjectId(detectedObject, newMlFile.imageDimensions),
            className: detectedObject.detection.class,
        }));
        // ?.filter((f) =>
        //     f.box.width > syncContext.config.faceDetection.minFaceSize
        // );
        console.log('[MLService] Detected Objects: ', newMlFile.things?.length);
    }

    async getAllSyncedThingsMap(syncContext: MLSyncContext) {
        if (syncContext.allSyncedThingsMap) {
            return syncContext.allSyncedThingsMap;
        }

        syncContext.allSyncedThingsMap = await mlIDbStorage.getAllThingsMap();
        return syncContext.allSyncedThingsMap;
    }

    public async clusterThingClasses(
        syncContext: MLSyncContext
    ): Promise<ThingClass[]> {
        const allObjectsMap = await this.getAllSyncedThingsMap(syncContext);
        const allObjects = getAllThingsFromMap(allObjectsMap);
        const objectClusters = new Map<string, number[]>();
        allObjects.map((object) => {
            if (!objectClusters.has(object.detection.class)) {
                objectClusters.set(object.detection.class, []);
            }
            const objectsInCluster = objectClusters.get(object.detection.class);
            objectsInCluster.push(object.fileID);
        });
        return [...objectClusters.entries()].map(([className, files], id) => ({
            id,
            className,
            files,
        }));
    }

    async syncThingClassesIndex(syncContext: MLSyncContext) {
        const filesVersion = await mlIDbStorage.getIndexVersion('files');
        console.log(
            'thingClasses',
            await mlIDbStorage.getIndexVersion('thingClasses')
        );
        if (
            filesVersion <= (await mlIDbStorage.getIndexVersion('thingClasses'))
        ) {
            console.log(
                '[MLService] Skipping people index as already synced to latest version'
            );
            return;
        }

        const thingClasses = await this.clusterThingClasses(syncContext);

        if (!thingClasses || thingClasses.length < 1) {
            return;
        }

        await mlIDbStorage.clearAllThingClasses();

        for (const thingClass of thingClasses) {
            await mlIDbStorage.putThingClass(thingClass);
        }

        await mlIDbStorage.setIndexVersion('thingClasses', filesVersion);
    }

    async getAllThingClasses() {
        return await mlIDbStorage.getAllThingClasses();
    }
}

export default new ObjectService();
