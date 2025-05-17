import { Component, ViewChild, ElementRef, HostListener, Input, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import AgoraRTC, { IAgoraRTCClient, IRemoteVideoTrack, IRemoteAudioTrack } from 'agora-rtc-sdk-ng';
import { iif } from 'rxjs';

@Component({
    selector: 'app-livestream-viewer',
    templateUrl: './livestream-viewer.component.html',
    styleUrls: ['./livestream-viewer.component.scss']
})
export class LivestreamViewerComponent implements OnInit {
    @ViewChild('videoElement') videoElement!: ElementRef;
    @Input() coinId: string = '';
    @Input() count: any = 0;

    private client: IAgoraRTCClient;
    private remoteVideoTrack: IRemoteVideoTrack | any;
    private remoteAudioTrack: IRemoteAudioTrack | any;
    private remoteUsers: Set<string> = new Set();

    isWatching: boolean = false;
    streamTitle: string = '';
    streamDescription: string = '';
    sizeArray = ['small', 'medium', 'large'];

    dimensions = { width: 320, height: 180 };
    position = { x: 20, y: 20 };
    isDragging = false;
    isResizing = false;
    dragOffset = { x: 0, y: 0 };
    resizeOffset = { x: 0, y: 0 };
    currentSize: 'small' | 'medium' | 'large' = 'small';
    isAudioEnabled: boolean = true;
    isVideoEnabled: boolean = true;

    private readonly sizeDimensions = {
        small: { width: 320, height: 180 },
        medium: { width: 480, height: 270 },
        large: { width: 640, height: 360 }
    };

    constructor(
        private http: HttpClient,
        private route: ActivatedRoute
    ) {
        this.client = AgoraRTC.createClient({ mode: "live", codec: "h264" });
    }

    async ngOnInit() {
        this.join();
    }

    async join() {
        try {
            const response: any = await this.http.get(`http://127.0.0.1:3000/livestream/${this.coinId}`).toPromise();
            const { title, description, token, channelName, appId, uid } = response.data;

            const isLive = true; // À adapter selon votre logique
            if (isLive) {
                this.streamTitle = title;
                this.streamDescription = description;
                await this.joinStream(appId, channelName, token, uid);
            }
        } catch (error) {
            console.error('Erreur lors du chargement du stream:', error);
        }
    }

    toggleMicrophone() {
        this.isAudioEnabled = !this.isAudioEnabled;
        // Ajoutez ici la logique pour activer/désactiver le microphone
        if (this.isAudioEnabled) {
            this.remoteAudioTrack.setVolume(100); // Volume normal
        } else {
            this.remoteAudioTrack.setVolume(0); // Volume normal
        }
    }

    toggleCamera() {
        this.isVideoEnabled = !this.isVideoEnabled;
        // Ajoutez ici la logique pour activer/désactiver la caméra
        if (this.videoElement && this.videoElement.nativeElement.srcObject) {
            const stream = this.videoElement.nativeElement.srcObject as MediaStream;
            stream.getVideoTracks().forEach(track => {
                track.enabled = this.isVideoEnabled;
            });
        }
    }

    private async setupAgoraEvents() {


        this.client.on("user-published", async (user, mediaType) => {
            await this.client.subscribe(user, mediaType);

            if (mediaType === "video") {
                this.remoteVideoTrack = user.videoTrack;
                if (this.videoElement?.nativeElement) {
                    this.remoteVideoTrack?.play(this.videoElement.nativeElement, {
                    });
                }
            }
            if (mediaType === "audio") {
                this.remoteAudioTrack = user.audioTrack;
                this.remoteAudioTrack?.play();
            }
        });

        this.client.on("user-unpublished", (user, mediaType) => {
            if (mediaType === "video") {
                this.remoteVideoTrack = null;
            }
            if (mediaType === "audio") {
                this.remoteAudioTrack?.stop();
                this.remoteAudioTrack = null;
            }
        });

        this.client.on("connection-state-change", (curState, prevState) => {
        });
        
    }


    private async joinStream(appId: string, channelName: string, token: string, uid: number) {
        try {
            await this.client.setClientRole("audience");
            await this.client.join(appId, channelName, token, uid);

            await this.setupAgoraEvents();

            this.isWatching = true;
            this.setSize('medium');

            // Initialiser le compteur
            this.remoteUsers.clear();

        } catch (error) {
            console.error('Erreur lors de la connexion au stream:', error);
            throw error;
        }
    }

    async leaveStream() {
        try {
            // Nettoyer le compteur
            this.remoteUsers.clear();

            if (this.remoteAudioTrack) {
                this.remoteAudioTrack.stop();
                this.remoteAudioTrack = null;
            }
            if (this.remoteVideoTrack) {
                this.remoteVideoTrack = null;
            }

            await this.client.leave();
            this.isWatching = false;

            if (this.videoElement?.nativeElement) {
                this.videoElement.nativeElement.srcObject = null;
            }
        } catch (error) {
            console.error('Erreur lors de la déconnexion du stream:', error);
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

            if (this.dimensions.width <= this.sizeDimensions.small.width) {
                this.currentSize = 'small';
            } else if (this.dimensions.width <= this.sizeDimensions.medium.width) {
                this.currentSize = 'medium';
            } else {
                this.currentSize = 'large';
            }
        }
    }

    @HostListener('document:mouseup')
    stopDragging() {
        this.isDragging = false;
        this.isResizing = false;
    }

    setSize(size: 'small' | 'medium' | 'large') {
        this.currentSize = size;
        const newDimensions = this.sizeDimensions[size];

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

    @HostListener('window:beforeunload')
    ngOnDestroy() {
        this.leaveStream();
    }
}
