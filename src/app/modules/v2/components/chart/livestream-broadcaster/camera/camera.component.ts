import { Component, ElementRef, Input, ViewChild } from '@angular/core';

@Component({
    selector: 'app-camera',
    template: `
        <video #videoElement 
               autoplay 
               playsinline
               muted
               class="w-full h-full object-cover">
        </video>
    `
})
export class CameraComponent {
    @ViewChild('videoElement') videoElement!: ElementRef;
    @Input() streamId!: string;
    @Input() rtmpUrl!: string;

    private cameraMediaRecorder: MediaRecorder | null = null;
    cameraStream: MediaStream | null = null;
    private cameraWsConnection: WebSocket | null = null;


    ngOnInit(){
        this.initializeCamera();
    }
    async initializeCamera() {
        try {
            await this.cleanup();
            await this.connectWebSocket();

            const streamConfig = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                },
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 44100,
                    channelCount: 2
                }
            };

            this.cameraStream = await navigator.mediaDevices.getUserMedia(streamConfig);
            this.setupMediaRecorder();

        } catch (error) {
            console.error('Erreur initialisation caméra:', error);
            throw error;
        }
    }

    private async connectWebSocket() {
        try {
            const wsUrl = `ws://localhost:3002?streamId=${this.streamId}&rtmpUrl=${encodeURIComponent(this.rtmpUrl)}&mode=camera`;
            this.cameraWsConnection = new WebSocket(wsUrl);

            this.cameraWsConnection.onopen = () => console.log('WebSocket camera connecté');
            this.cameraWsConnection.onerror = (error) => console.error('WebSocket error:', error);
            this.cameraWsConnection.onclose = () => console.log('WebSocket fermé');

        } catch (error) {
            console.error('Erreur connexion WebSocket:', error);
            throw error;
        }
    }

    private setupMediaRecorder() {
        if (!this.cameraStream) return;

        this.cameraMediaRecorder = new MediaRecorder(this.cameraStream, {
            mimeType: 'video/webm;codecs=h264',
            videoBitsPerSecond: 2500000,
            audioBitsPerSecond: 128000
        });

        this.cameraMediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && this.cameraWsConnection?.readyState === WebSocket.OPEN) {
                this.cameraWsConnection.send(event.data);
            }
        };

        this.cameraMediaRecorder.start(250);
        this.videoElement.nativeElement.srcObject = this.cameraStream;
    }

    toggleAudio(enabled: boolean) {
        if (this.cameraStream) {
            this.cameraStream.getAudioTracks().forEach(track => {
                track.enabled = enabled;
            });
        }
    }

    toggleVideo(enabled: boolean) {
        if (this.cameraStream) {
            this.cameraStream.getVideoTracks().forEach(track => {
                track.enabled = enabled;
            });
        }
    }

    async cleanup() {
        if (this.cameraMediaRecorder) {
            this.cameraMediaRecorder.stop();
            this.cameraMediaRecorder = null;
        }
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        if (this.cameraWsConnection) {
            this.cameraWsConnection.close();
            this.cameraWsConnection = null;
        }
        if (this.videoElement?.nativeElement) {
            this.videoElement.nativeElement.srcObject = null;
        }
    }

    ngOnDestroy() {
        this.cleanup();
    }
}
