import React, { useContext, useEffect, useRef, useState } from 'react';
import Photoswipe from 'photoswipe';
import PhotoswipeUIDefault from 'photoswipe/dist/photoswipe-ui-default';
import classnames from 'classnames';
import FavButton from 'components/FavButton';
import {
    addToFavorites,
    removeFromFavorites,
} from 'services/collectionService';
import { EnteFile } from 'types/file';
import constants from 'utils/strings/constants';
import exifr from 'exifr';
import events from './events';
import { downloadFile } from 'utils/file';
import { prettyPrintExif } from 'utils/exif';
import { livePhotoBtnHTML } from 'components/LivePhotoBtn';
import { logError } from 'utils/sentry';

import { FILE_TYPE } from 'constants/file';
import { sleep } from 'utils/common';
import { playVideo, pauseVideo } from 'utils/photoFrame';
import { PublicCollectionGalleryContext } from 'utils/publicCollectionGallery';
import { AppContext } from 'pages/_app';
import { InfoModal } from './InfoDialog';
import { defaultLivePhotoDefaultOptions } from 'constants/photoswipe';
import { LivePhotoBtn } from './styledComponents/LivePhotoBtn';

interface Iprops {
    isOpen: boolean;
    items: any[];
    currentIndex?: number;
    onClose?: (needUpdate: boolean) => void;
    gettingData: (instance: any, index: number, item: EnteFile) => void;
    id?: string;
    className?: string;
    favItemIds: Set<number>;
    isSharedCollection: boolean;
    isTrashCollection: boolean;
    enableDownload: boolean;
    isSourceLoaded: boolean;
}

function PhotoSwipe(props: Iprops) {
    const pswpElement = useRef<HTMLDivElement>();
    const [photoSwipe, setPhotoSwipe] =
        useState<Photoswipe<Photoswipe.Options>>();

    const { isOpen, items, isSourceLoaded } = props;
    const [isFav, setIsFav] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [metadata, setMetaData] = useState<EnteFile['metadata']>(null);
    const [exif, setExif] = useState<any>(null);
    const [livePhotoBtnOptions, setLivePhotoBtnOptions] = useState(
        defaultLivePhotoDefaultOptions
    );
    const needUpdate = useRef(false);
    const publicCollectionGalleryContext = useContext(
        PublicCollectionGalleryContext
    );
    const appContext = useContext(AppContext);

    useEffect(() => {
        if (!pswpElement) return;
        if (isOpen) {
            openPhotoSwipe();
        }
        if (!isOpen) {
            closePhotoSwipe();
        }
        return () => {
            closePhotoSwipe();
        };
    }, [isOpen]);

    useEffect(() => {
        updateItems(items);
    }, [items]);

    useEffect(() => {
        if (photoSwipe) {
            photoSwipe.options.arrowKeys = !showInfo;
            photoSwipe.options.escKey = !showInfo;
        }
    }, [showInfo]);

    useEffect(() => {
        if (!isOpen) return;
        const item = items[photoSwipe?.getCurrentIndex()];
        if (item && item.metadata.fileType === FILE_TYPE.LIVE_PHOTO) {
            const getVideoAndImage = () => {
                const video = document.getElementById(
                    `live-photo-video-${item.id}`
                );
                const image = document.getElementById(
                    `live-photo-image-${item.id}`
                );
                return { video, image };
            };

            const { video, image } = getVideoAndImage();

            if (video && image) {
                setLivePhotoBtnOptions({
                    click: async () => {
                        await playVideo(video, image);
                    },
                    hide: async () => {
                        await pauseVideo(video, image);
                    },
                    show: async () => {
                        await playVideo(video, image);
                    },
                    visible: true,
                    loading: false,
                });
            } else {
                setLivePhotoBtnOptions({
                    ...defaultLivePhotoDefaultOptions,
                    visible: true,
                    loading: true,
                });
            }

            const downloadLivePhotoBtn = document.getElementById(
                `download-btn-${item.id}`
            ) as HTMLButtonElement;
            if (downloadLivePhotoBtn) {
                const downloadLivePhoto = () => {
                    downloadFileHelper(photoSwipe.currItem);
                };

                downloadLivePhotoBtn.addEventListener(
                    'click',
                    downloadLivePhoto
                );
                return () => {
                    downloadLivePhotoBtn.removeEventListener(
                        'click',
                        downloadLivePhoto
                    );
                    setLivePhotoBtnOptions(defaultLivePhotoDefaultOptions);
                };
            }

            return () => {
                setLivePhotoBtnOptions(defaultLivePhotoDefaultOptions);
            };
        }
    }, [photoSwipe?.currItem, isOpen, isSourceLoaded]);

    function updateFavButton() {
        setIsFav(isInFav(this?.currItem));
    }

    const openPhotoSwipe = () => {
        const { items, currentIndex } = props;
        const options = {
            history: false,
            maxSpreadZoom: 5,
            index: currentIndex,
            showHideOpacity: true,
            getDoubleTapZoom(isMouseClick, item) {
                if (isMouseClick) {
                    return 2.5;
                }
                // zoom to original if initial zoom is less than 0.7x,
                // otherwise to 1.5x, to make sure that double-tap gesture always zooms image
                return item.initialZoomLevel < 0.7 ? 1 : 1.5;
            },
            getThumbBoundsFn: (index) => {
                try {
                    const file = items[index];
                    const ele = document.getElementById(`thumb-${file.id}`);
                    if (ele) {
                        const rect = ele.getBoundingClientRect();
                        const pageYScroll =
                            window.pageYOffset ||
                            document.documentElement.scrollTop;
                        return {
                            x: rect.left,
                            y: rect.top + pageYScroll,
                            w: rect.width,
                        };
                    }
                    return null;
                } catch (e) {
                    return null;
                }
            },
        };
        const photoSwipe = new Photoswipe(
            pswpElement.current,
            PhotoswipeUIDefault,
            items,
            options
        );
        events.forEach((event) => {
            const callback = props[event];
            if (callback || event === 'destroy') {
                photoSwipe.listen(event, function (...args) {
                    if (callback) {
                        args.unshift(this);
                        callback(...args);
                    }
                    if (event === 'destroy') {
                        handleClose();
                    }
                    if (event === 'close') {
                        handleClose();
                    }
                });
            }
        });
        photoSwipe.listen('beforeChange', function () {
            updateInfo.call(this);
            updateFavButton.call(this);
        });
        photoSwipe.listen('resize', checkExifAvailable);
        photoSwipe.init();
        needUpdate.current = false;
        setPhotoSwipe(photoSwipe);
    };

    const closePhotoSwipe = () => {
        if (photoSwipe) photoSwipe.close();
    };

    const handleClose = () => {
        const { onClose } = props;
        if (typeof onClose === 'function') {
            onClose(needUpdate.current);
        }
        const videoTags = document.getElementsByTagName('video');
        for (const videoTag of videoTags) {
            videoTag.pause();
        }
        handleCloseInfo();
    };
    const isInFav = (file) => {
        const { favItemIds } = props;
        if (favItemIds && file) {
            return favItemIds.has(file.id);
        }
        return false;
    };

    const onFavClick = async (file) => {
        const { favItemIds } = props;
        if (!isInFav(file)) {
            favItemIds.add(file.id);
            addToFavorites(file);
            setIsFav(true);
        } else {
            favItemIds.delete(file.id);
            removeFromFavorites(file);
            setIsFav(false);
        }
        needUpdate.current = true;
    };

    const updateItems = (items = []) => {
        if (photoSwipe) {
            photoSwipe.items.length = 0;
            items.forEach((item) => {
                photoSwipe.items.push(item);
            });
            photoSwipe.invalidateCurrItems();
            // photoSwipe.updateSize(true);
        }
    };

    const checkExifAvailable = async () => {
        setExif(null);
        await sleep(100);
        try {
            const img: HTMLImageElement = document.querySelector(
                '.pswp__img:not(.pswp__img--placeholder)'
            );
            if (img) {
                const exifData = await exifr.parse(img);
                if (!exifData) {
                    return;
                }
                exifData.raw = prettyPrintExif(exifData);
                setExif(exifData);
            }
        } catch (e) {
            logError(e, 'exifr parsing failed');
        }
    };

    function updateInfo() {
        const file: EnteFile = this?.currItem;
        if (file?.metadata) {
            setMetaData(file.metadata);
            setExif(null);
            checkExifAvailable();
        }
    }

    const handleCloseInfo = () => {
        setShowInfo(false);
    };
    const handleOpenInfo = () => {
        setShowInfo(true);
    };

    const downloadFileHelper = async (file) => {
        appContext.startLoading();
        await downloadFile(
            file,
            publicCollectionGalleryContext.accessedThroughSharedURL,
            publicCollectionGalleryContext.token,
            publicCollectionGalleryContext.passwordToken
        );

        appContext.finishLoading();
    };
    const scheduleUpdate = () => (needUpdate.current = true);
    const { id } = props;
    let { className } = props;
    className = classnames(['pswp', className]).trim();
    return (
        <>
            <div
                id={id}
                className={className}
                tabIndex={Number('-1')}
                role="dialog"
                aria-hidden="true"
                ref={pswpElement}>
                <div className="pswp__bg" />
                <div className="pswp__scroll-wrap">
                    <LivePhotoBtn
                        onClick={livePhotoBtnOptions.click}
                        onMouseEnter={livePhotoBtnOptions.show}
                        onMouseLeave={livePhotoBtnOptions.hide}
                        disabled={livePhotoBtnOptions.loading}
                        style={{
                            display: livePhotoBtnOptions.visible
                                ? 'block'
                                : 'none',
                        }}>
                        {livePhotoBtnHTML} {constants.LIVE}
                    </LivePhotoBtn>
                    <div className="pswp__container">
                        <div className="pswp__item" />
                        <div className="pswp__item" />
                        <div className="pswp__item" />
                    </div>
                    <div className="pswp__ui pswp__ui--hidden">
                        <div className="pswp__top-bar">
                            <div className="pswp__counter" />

                            <button
                                className="pswp__button pswp__button--close"
                                title={constants.CLOSE}
                            />

                            {props.enableDownload && (
                                <button
                                    className="pswp-custom download-btn"
                                    title={constants.DOWNLOAD}
                                    onClick={() =>
                                        downloadFileHelper(photoSwipe.currItem)
                                    }
                                />
                            )}
                            <button
                                className="pswp__button pswp__button--fs"
                                title={constants.TOGGLE_FULLSCREEN}
                            />
                            <button
                                className="pswp__button pswp__button--zoom"
                                title={constants.ZOOM_IN_OUT}
                            />
                            {!props.isSharedCollection &&
                                !props.isTrashCollection && (
                                    <FavButton
                                        size={44}
                                        isClick={isFav}
                                        onClick={() => {
                                            onFavClick(photoSwipe?.currItem);
                                        }}
                                    />
                                )}
                            {!props.isSharedCollection && (
                                <button
                                    className="pswp-custom info-btn"
                                    title={constants.INFO}
                                    onClick={handleOpenInfo}
                                />
                            )}
                            <div className="pswp__preloader">
                                <div className="pswp__preloader__icn">
                                    <div className="pswp__preloader__cut">
                                        <div className="pswp__preloader__donut" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="pswp__share-modal pswp__share-modal--hidden pswp__single-tap">
                            <div className="pswp__share-tooltip" />
                        </div>
                        <button
                            className="pswp__button pswp__button--arrow--left"
                            title={constants.PREVIOUS}
                        />
                        <button
                            className="pswp__button pswp__button--arrow--right"
                            title={constants.NEXT}
                        />
                        <div className="pswp__caption">
                            <div />
                        </div>
                    </div>
                </div>
            </div>
            <InfoModal
                shouldDisableEdits={props.isSharedCollection}
                showInfo={showInfo}
                handleCloseInfo={handleCloseInfo}
                items={items}
                photoSwipe={photoSwipe}
                metadata={metadata}
                exif={exif}
                scheduleUpdate={scheduleUpdate}
            />
        </>
    );
}

export default PhotoSwipe;
