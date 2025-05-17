import { Component, ViewChild, ElementRef, HostListener, Input, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import AgoraRTC, {
    IAgoraRTCClient,
    ICameraVideoTrack,
    IMicrophoneAudioTrack,
    ILocalVideoTrack,
    ClientRole
} from 'agora-rtc-sdk-ng';

@Component({
    selector: 'app-livestream-broadcaster',
    templateUrl: './livestream-broadcaster.component.html',
    styleUrls: ['./livestream-broadcaster.component.scss']
})
export class LivestreamBroadcasterComponent implements OnInit {
    @ViewChild('videoElement') videoElement!: ElementRef;
    @Input() coinId: string = '';
    @Input() userId: string = '';
    @Input() count: any = 0;


    private activeMediaStreams: MediaStream[] = [];
    private client: IAgoraRTCClient;
    localAudioTrack: IMicrophoneAudioTrack | null = null;
    localVideoTrack: ICameraVideoTrack | null = null;
    screenTrack: ILocalVideoTrack | any;

    streamTitle: string = '';
    streamDescription: string = '';
    isStreaming: boolean = false;
    isAudioEnabled: boolean = true;
    isVideoEnabled: boolean = true;
    isScreenSharing: boolean = false;
    isLoading: boolean = false;

    // Gestion de la taille
    sizeArray = ['small', 'medium', 'large'];
    currentSize: 'small' | 'medium' | 'large' = 'small';
    dimensions = { width: 320, height: 180 };
    private readonly sizeDimensions = {
        small: { width: 320, height: 180 },
        medium: { width: 480, height: 270 },
        large: { width: 640, height: 360 }
    };

    // Gestion du drag & resize
    position = { x: 20, y: 20 };
    isDragging = false;
    isResizing = false;
    dragOffset = { x: 0, y: 0 };
    resizeOffset = { x: 0, y: 0 };

    // Gestion des viewers
    private remoteUsers: Set<string> = new Set();

    constructor(
        private http: HttpClient,
        private route: ActivatedRoute
    ) {
        this.client = AgoraRTC.createClient({
            mode: "live",
            codec: "h264",
            role: "host"
        });
    }

    async ngOnInit() {
    }



    async startStream() {
        this.isLoading = true;
        this.isStreaming = true;
        try {


            // Vérifier les permissions
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            this.activeMediaStreams.push(stream);

            const response: any = await this.http.post(`http://127.0.0.1:3000/livestream/create`, {
                coinId: this.coinId,
                title: this.streamTitle,
                description: this.streamDescription
            }).toPromise();

            const { channelName, token, appId, uid } = response.data;

            await this.client.setClientRole("host");
            await this.client.join(appId, channelName, token, uid);



            [this.localAudioTrack, this.localVideoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
                {
                    encoderConfig: "high_quality_stereo",
                    AGC: true,
                    AEC: true,
                    ANS: true
                },
                {
                    encoderConfig: {
                        width: 1280,
                        height: 720,
                        frameRate: 30,
                        bitrateMin: 1000,
                        bitrateMax: 2500,
                    }
                }
            );

            await this.client.publish([this.localAudioTrack, this.localVideoTrack]);

            if (this.videoElement?.nativeElement && this.localVideoTrack) {
                this.videoElement.nativeElement.srcObject = new MediaStream([this.localVideoTrack.getMediaStreamTrack()]);
                this.localVideoTrack.play(this.videoElement.nativeElement, {
                    mirror: false
                });
            }

        } catch (error) {
            console.error('Erreur lors du démarrage du stream:', error);
            alert('Une erreur est survenue. Veuillez vérifier vos permissions caméra/micro.');
            this.isStreaming = false;
        } finally {
            this.isLoading = false;
        }
    }

    async toggleScreenShare() {
        try {
            if (!this.isScreenSharing) {
                this.isScreenSharing = true;
                if (this.localVideoTrack) {
                    await this.client.unpublish(this.localVideoTrack);
                    this.localVideoTrack.close();
                }

                this.screenTrack = await AgoraRTC.createScreenVideoTrack({
                    encoderConfig: {
                        width: 1920,
                        height: 1080,
                        frameRate: 30,
                        bitrateMin: 1000,
                        bitrateMax: 3000
                    },
                    screenSourceType: 'screen'
                }, "auto");

                await this.client.publish(this.screenTrack);

                if (this.videoElement?.nativeElement) {
                    this.videoElement.nativeElement.srcObject = new MediaStream([this.screenTrack.getMediaStreamTrack()]);
                }

                this.screenTrack.on("track-ended", async () => {
                    await this.stopScreenSharing();
                });
            } else {
                await this.stopScreenSharing();
            }
        } catch (error) {
            console.error('Erreur lors du partage d\'écran:', error);
            this.isScreenSharing = false;
        }
    }

    private async stopScreenSharing() {
        try {
            if (this.screenTrack) {
                await this.client.unpublish(this.screenTrack);
                this.screenTrack.close();
                this.screenTrack = null;
            }

            this.localVideoTrack = await AgoraRTC.createCameraVideoTrack({
                encoderConfig: {
                    width: 1280,
                    height: 720,
                    frameRate: 30,
                    bitrateMin: 1000,
                    bitrateMax: 2500,
                }
            });
            await this.client.publish(this.localVideoTrack);

            if (this.videoElement?.nativeElement) {
                this.videoElement.nativeElement.srcObject = new MediaStream([this.localVideoTrack.getMediaStreamTrack()]);
            }

            this.isScreenSharing = false;
        } catch (error) {
            console.error('Erreur lors de l\'arrêt du partage d\'écran:', error);
        }
    }

    async toggleMicrophone() {
        if (this.localAudioTrack) {
            this.isAudioEnabled = !this.isAudioEnabled;
            await this.localAudioTrack.setEnabled(this.isAudioEnabled);
        }
    }

    async toggleCamera() {
        try {
            if (!this.isScreenSharing) {
                this.isVideoEnabled = !this.isVideoEnabled;

                if (this.localVideoTrack) {
                    if (this.isVideoEnabled) {
                        // Recréer le track vidéo
                        await this.client.unpublish(this.localVideoTrack);
                        this.localVideoTrack.close();

                        const obj = {
                            width: 1280,
                            height: 720,
                            frameRate: 30,
                            bitrateMin: 1000,
                            bitrateMax: 2500,
                        }
                        //@ts-ignore
                        this.localVideoTrack = await AgoraRTC.createCameraVideoTrack({
                            encoderConfig: obj
                        });

                        await this.client.publish(this.localVideoTrack);

                        if (this.videoElement?.nativeElement) {
                            this.videoElement.nativeElement.srcObject = new MediaStream([this.localVideoTrack.getMediaStreamTrack()]);
                        }
                    } else {
                        await this.localVideoTrack.setEnabled(false);
                    }
                }
            }
        } catch (error) {
            console.error('Erreur lors du toggle de la caméra:', error);
        }
    }


    async endStream() {
        try {
            // Arrêter le streaming si actif
            if (this.isStreaming) {
                // 1. Arrêter tous les tracks de mediaStream
                // 1. Arrêter tous les streams actifs stockés
                this.activeMediaStreams.forEach(stream => {
                    stream.getTracks().forEach(track => {
                        track.enabled = false;
                        track.stop();
                    });
                });
                this.activeMediaStreams = [];
                // 2. Arrêter les tracks de l'élément vidéo
                if (this.videoElement?.nativeElement) {
                    const stream = this.videoElement.nativeElement.srcObject;
                    if (stream instanceof MediaStream) {
                        stream.getTracks().forEach(track => {
                            track.stop();
                        });
                    }
                    this.videoElement.nativeElement.srcObject = null;
                }

                // 3. Arrêter les tracks Agora
                if (this.localAudioTrack) {
                    this.localAudioTrack.stop();
                    this.localAudioTrack.close();
                    this.localAudioTrack = null;
                }

                if (this.localVideoTrack) {
                    this.localVideoTrack.stop();
                    this.localVideoTrack.close();
                    this.localVideoTrack = null;
                }

                if (this.screenTrack) {
                    this.screenTrack.stop();
                    this.screenTrack.close();
                    this.screenTrack = null;
                }

                // 4. Quitter le client Agora
                if (this.client) {
                    await this.client.leave();
                    this.client.removeAllListeners();
                }

                // 5. Arrêter tous les tracks du navigateur
                const streams = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
                    .catch(() => null);
                if (streams) {
                    streams.getTracks().forEach(track => {
                        track.stop();
                    });
                }

                // 6. Supprimer le livestream du serveur
                if (this.coinId) {
                    try {
                        await this.http.delete(`http://127.0.0.1:3000/livestream/${this.coinId}`).toPromise();
                    } catch (error) {
                        console.error('Erreur lors de la suppression du livestream:', error);
                    }
                }

                // 7. Réinitialiser les états
                this.isStreaming = false;
                this.isScreenSharing = false;
                this.isAudioEnabled = true;
                this.isVideoEnabled = true;
            }
        } catch (error) {
            console.error('Erreur lors de l\'arrêt du stream:', error);
        }
    }

    setSize(size: 'small' | 'medium' | 'large') {
        this.currentSize = size as 'small' | 'medium' | 'large';
        const newDimensions = this.sizeDimensions[this.currentSize];

        const maxWidth = window.innerWidth - this.position.x;
        const maxHeight = window.innerHeight - this.position.y;

        this.dimensions = {
            width: Math.min(newDimensions.width, maxWidth),
            height: Math.min(newDimensions.height, maxHeight)
        };

        if (this.position.x + this.dimensions.width > window.innerWidth) {
            this.position.x = window.innerWidth - this.dimensions.width;
        }
        if (this.position.y + this.dimensions.height > window.innerHeight) {
            this.position.y = window.innerHeight - this.dimensions.height;
        }
    }

    startDragging(event: MouseEvent) {
        if (event.target instanceof Element &&
            (event.target.classList.contains('cursor-se-resize') ||
                event.target.closest('.cursor-se-resize'))) {
            return;
        }

        this.isDragging = true;
        this.dragOffset.x = event.clientX - this.position.x;
        this.dragOffset.y = event.clientY - this.position.y;
        event.preventDefault();
    }

    startResizing(event: MouseEvent) {
        this.isResizing = true;
        this.resizeOffset.x = this.dimensions.width - event.clientX;
        this.resizeOffset.y = this.dimensions.height - event.clientY;
        event.preventDefault();
        event.stopPropagation();
    }

    @HostListener('document:mousemove', ['$event'])
    onMouseMove(event: MouseEvent) {
        if (this.isDragging) {
            this.position.x = event.clientX - this.dragOffset.x;
            this.position.y = event.clientY - this.dragOffset.y;

            const maxX = window.innerWidth - this.dimensions.width;
            const maxY = window.innerHeight - this.dimensions.height;

            this.position.x = Math.min(Math.max(0, this.position.x), maxX);
            this.position.y = Math.min(Math.max(0, this.position.y), maxY);
        }

        if (this.isResizing) {
            const newWidth = event.clientX + this.resizeOffset.x;
            const newHeight = event.clientY + this.resizeOffset.y;

            const minWidth = 240;
            const minHeight = 135;
            const maxWidth = window.innerWidth - this.position.x;
            const maxHeight = window.innerHeight - this.position.y;

            this.dimensions.width = Math.min(Math.max(minWidth, newWidth), maxWidth);
            this.dimensions.height = Math.min(Math.max(minHeight, newHeight), maxHeight);
        }
    }

    @HostListener('document:mouseup')
    stopDragging() {
        this.isDragging = false;
        this.isResizing = false;
    }

    ngOnDestroy() {
        this.endStream();
    }
}
