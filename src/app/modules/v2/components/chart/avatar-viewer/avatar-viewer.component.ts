import { Component, Input} from '@angular/core';
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
  constructor(
    private http: HttpClient,
    public wsService: SocketIoTransactionService,
    public solanaService: SolanaService,
  ) { }

  ngOnInit() {}

}
