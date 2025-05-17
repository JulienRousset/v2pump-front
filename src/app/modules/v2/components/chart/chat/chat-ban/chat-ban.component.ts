// chat-ban.component.ts
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IPageInfo } from 'ngx-virtual-scroller';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ChatService } from 'src/app/chat.service';
import { NotificationService } from 'src/app/notification.service';

@Component({
  selector: 'app-chat-ban',
  templateUrl: './chat-ban.component.html',
  styleUrls: ['./chat-ban.component.scss'],
})
export class ChatBanComponent implements OnInit {
  public bannedUsers: any[] = [];
  public searchTerm: string = '';
  public isLoading: boolean = false;
  public error: string | null = null;
  private searchSubject = new Subject<string>();

  public offset: number = 0;
  public limit: number = 5;
  public hasMore: boolean = true;

  @Input() coinId: string = '';
  @Input() isOpen: any;
  @Output() isOpenChange = new EventEmitter<boolean>();

  constructor(public chatService: ChatService, public notificationService: NotificationService) {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.resetAndSearch();
    });
  }

  ngOnInit() {
    this.loadBannedUsers();
  }

  private resetAndSearch() {
    this.offset = 0;
    this.bannedUsers = [];
    this.hasMore = true;
    this.loadBannedUsers();
  }

  async loadBannedUsers() {
    if (!this.hasMore || this.isLoading) return;

    try {
      this.isLoading = true;
      this.error = null;

      const response = await this.chatService.getBannedMembers(
        this.coinId,
        this.offset,
        this.limit,
        this.searchTerm
      );

      this.bannedUsers = [...this.bannedUsers, ...response.data.bans];
      this.hasMore = response.data.hasMore;
      this.offset += this.limit;
    } catch (error) {
      this.error = 'Error loading banned users';
      console.error(error);
    } finally {
      this.isLoading = false;
    }
  }

  async onVsChange(event: IPageInfo) {
    const scrollPercentage = (event.endIndex + 1) / this.bannedUsers.length;

    if (scrollPercentage > 0.9 && !this.isLoading && this.hasMore) {
      await this.loadBannedUsers();
    }
  }

  onSearch(event: any) {
    const term = event.target.value;
    this.searchTerm = term;
    this.searchSubject.next(term);
  }


  async unbanUser(userId: string) {
    try {
      await this.chatService.unbanMember(this.coinId, userId);
      this.bannedUsers = this.bannedUsers.filter(ban => ban.bannedUser.id !== userId);
      this.notificationService.showSuccess('User successfully unbanned')
    } catch (error) {
      this.error = 'Error unbanning user';
      this.notificationService.showError('Failed to unban user')
      console.error(error);
    }
  }

  formatTimeRemaining(expiresAt: string | null): string {
    if (!expiresAt) return 'Permanent';

    const remaining = new Date(expiresAt).getTime() - new Date().getTime();
    if (remaining <= 0) return 'Expired';

    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
}
