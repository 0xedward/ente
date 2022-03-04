import { MlFileData, Face } from 'types/machineLearning';
import mlIDbStorage from 'utils/storage/mlIDbStorage';
import { mlFilesStore } from 'utils/storage/mlStorage';
import { getFaceId } from '.';
import { storeFaceCropForBlob } from './faceCrop';

// TODO: for migrating existing data, to be removed
export async function migrateExistingFiles() {
    const existingFiles: Array<MlFileData> = [];
    await mlFilesStore.iterate((mlFileData: MlFileData) => {
        if (!mlFileData.errorCount) {
            mlFileData.errorCount = 0;
            existingFiles.push(mlFileData);
        }
    });
    console.log('existing files: ', existingFiles.length);

    try {
        for (const file of existingFiles) {
            await mlIDbStorage.putFile(file);
        }
        await mlIDbStorage.setIndexVersion('files', 1);
        console.log('migrateExistingFiles done');
    } catch (e) {
        console.error(e);
    }
}

export async function migrateFaceCropsToCache() {
    console.time('migrateFaceCropsToCache');
    console.log('migrateFaceCropsToCache started');
    const allFiles = await mlIDbStorage.getAllFiles();
    const allFilesWithFaces = allFiles.filter(
        (f) => f.faces && f.faces.length > 0
    );
    const updatedFacesMap = new Map<number, Array<Face>>();

    for (const file of allFilesWithFaces) {
        let updated = false;
        for (const face of file.faces) {
            if (!face['id']) {
                const faceCropBlob = face.crop['image'];
                const faceId = getFaceId(face, file.imageDimensions);
                face.crop = await storeFaceCropForBlob(
                    faceId,
                    face.crop.imageBox,
                    faceCropBlob
                );
                face['id'] = faceId;
                updated = true;
            }
        }
        if (updated) {
            updatedFacesMap.set(file.fileId, file.faces);
        }
    }

    if (updatedFacesMap.size > 0) {
        console.log('updating face crops: ', updatedFacesMap.size);
        await mlIDbStorage.updateFaces(updatedFacesMap);
    } else {
        console.log('not updating face crops: ', updatedFacesMap.size);
    }
    console.timeEnd('migrateFaceCropsToCache');
}

export async function migrateFaceInterfaceUpdate() {
    console.time('migrateFaceInterfaceUpdate');
    console.log('migrateFaceInterfaceUpdate started');

    const faceSchemaVersion = await mlIDbStorage.getIndexVersion('faceSchema');
    if (faceSchemaVersion) {
        console.log('not running migrateFaceInterfaceUpdate');
        return;
    }

    const allFiles = await mlIDbStorage.getAllFiles();

    const updatedFiles = allFiles.map((file) => {
        const updatedFaces = file.faces?.map((f) => {
            const updatedFace = {
                id: f['faceId'],
                fileId: f.fileId,

                detection: {
                    box: f['box'],
                    landmarks: f['landmarks'],
                    probability: f['probability'],
                },
                crop: f['faceCrop'],
                alignment: {
                    affineMatrix: f['affineMatrix'],
                    center: f['center'],
                    rotation: f['rotation'],
                    size: f['size'],
                },
                embedding: Float32Array.from(f.embedding),

                personId: f.personId,
            } as Face;
            if (!updatedFace.id) {
                updatedFace.id = getFaceId(updatedFace, file.imageDimensions);
            }
            return updatedFace;
        });
        const updated: MlFileData = {
            fileId: file.fileId,

            faceDetectionMethod: file['detectionMethod'],
            faceCropMethod: {
                value: 'ArcFace',
                version: 1,
            },
            faceAlignmentMethod: file['alignmentMethod'],
            faceEmbeddingMethod: file['embeddingMethod'],

            faces: updatedFaces,

            imageDimensions: file.imageDimensions,
            imageSource: file.imageSource,
            errorCount: file.errorCount,
            lastErrorMessage: file.lastErrorMessage,
            mlVersion: file.mlVersion,
        };

        return updated;
    });

    console.log('migrateFaceInterfaceUpdate updating: ', updatedFiles.length);
    await mlIDbStorage.putAllFilesInTx(updatedFiles);

    await mlIDbStorage.setIndexVersion('faceSchema', 1);
    console.log('migrateFaceInterfaceUpdate done');
    console.timeEnd('migrateFaceInterfaceUpdate');
}
