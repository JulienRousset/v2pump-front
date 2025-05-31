import { Component, Input, HostListener} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { WebsocketApiService } from 'src/app/websocketapi.service';
import { SocketIoTransactionService } from 'src/app/socket-io-transaction.service';
import { SolanaService } from '@shared/services/solana.service';

@Component({
  selector: 'app-avatar-viewer',
  templateUrl: './avatar-viewer.component.html',
  styleUrls: ['./avatar-viewer.component.scss']
})
export class AvatarViewerComponent  {
  @Input() coinId: string = '';
  @Input() token: any;

  public transactions: any = [];
  loading: boolean = true;
  error: boolean = false;
  bars:any = [];
  width = 35;
  height = 35;

  constructor(
    private http: HttpClient,
    public wsService: SocketIoTransactionService,
    public solanaService: SolanaService,
  ) { }

  @HostListener('window:resize')
  
  onResize() {
    this.updateSize();
  }
  
  ngOnInit() {
    this.updateSize();
  }
  
  updateSize() {
    const isLargeScreen = window.innerWidth >= 1024; // Tailwind lg = 1024px
    this.width = isLargeScreen ? 100 : 35;
    this.height = isLargeScreen ? 100 : 35;
  }
  

}
