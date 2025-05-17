// chat.component.ts
import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, Output, EventEmitter, HostListener } from '@angular/core';
import { SolanaService } from '@shared/services/solana.service';
import { IPageInfo } from 'ngx-virtual-scroller';
import { EMPTY, Observable, of, Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, switchMap, take } from 'rxjs/operators';
import { ChatMessage, ChatService } from 'src/app/chat.service';
import { NotificationService } from 'src/app/notification.service';
import { TokenService } from 'src/app/token.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements OnInit, OnDestroy {
  @Input() coinId!: string;
  @ViewChild('scroll') chatscroll!: any;
  @Output() sendEvent = new EventEmitter<any>();
  @Input() avatarBottom!: any;

  public messages: any[] = [];
  public newMessage: string = '';
  public replyingTo: any | null = null;
  private subscription: Subscription | undefined;
  public isInitialLoad = true;
  private isFirstLetter = true;
  private lastMessageLength = 0;
  private lastSentStatus = false;


  optionsDropdown = [
    { label: 'Ban 1 minute', value: 1 },
    { label: 'Ban 3 minutes', value: 3 },
    { label: 'Ban 1 heure', value: 60 },
    { label: 'Ban 5 heures', value: 5 * 60 },
    { label: 'Ban 1 jour', value: 24 * 60 },
    { label: 'Ban 7 jours', value: 7 * 24 * 60 },
    { label: 'Ban 1 mois', value: 30 * 24 * 60 },
    { label: 'Ban 3 mois', value: 90 * 24 * 60 },
    { label: 'Ban 1 an', value: 365 * 24 * 60 },
    { label: 'Ban permanent', value: -1 }
  ];

  private pageSize: number = 50;
  private currentOffset: number = 0;
  private lastMessageTimestamp: number | any;
  public isLoading: boolean = false;
  public hasMoreMessages: boolean = true;
  private scrollToBottomPending = false;
  private loadMoreSubject = new Subject<void>();
  private destroy$ = new Subject<void>();
  private initializationSubscription: Subscription | undefined;
  public showPinnedMessages: boolean = false;
  public pinnedMessages: any[] = [];
  public isLoadingPinned = false;
  public isModeratorModalOpen = false;
  private pinnedOffset = 0;
  private pinnedPageSize = 40;
  private hasMorePinnedMessages = true;
  private loadingThreshold = 0.8;
  public openBanndedList = false;
  public role = 'user';
  public optionSettings: any = [];
  private walletSubscription?: Subscription;
  private messageSubject = new Subject<string>();
  activeMenuMessageId: string | null = null;
  pinnedMessageCollapsed: boolean = false;
  messageOptionsOthers: string[] = ['Reply', 'Like'];
  messageOptionsOthersAdmin: string[] = ['Reply', 'Like', 'Delete', 'Pin', 'Ban'];
  messageOptionsSelf: string[] = ['Like', 'Delete'];
  messageOptionsSelfAdmin: string[] = ['Like', 'Delete', 'Pin'];


  constructor(private chatService: ChatService, public solana: SolanaService, public tokenService: TokenService, public notificationService: NotificationService) { }

  async ngOnInit() {
    // Modifiez la souscription au changement de connexion
    this.walletSubscription = this.solana.isConnected$.subscribe(
      async (isConnected: boolean) => {
        if (isConnected) {
          // Déconnecter d'abord le websocket existant
          this.chatService.disconnect();
          
          // Réinitialiser les états
          this.messages = [];
          this.newMessage = '';
          this.replyingTo = null;
          this.currentOffset = 0;
          this.lastMessageTimestamp = null;
          this.isLoading = false;
          this.hasMoreMessages = true;
          this.scrollToBottomPending = false;
  
          // Reconnecter avec le nouveau token
          const token = this.solana.tokenService.getToken();
          this.chatService.connectToCoin(this.coinId, token);
  
          // Recharger les messages
          await this.loadInitialMessages();
          setTimeout(() => {
            this.scrollToBottom();
          }, 100);
        } else {
          // Si déconnecté, fermer la connexion websocket
          this.chatService.disconnect();
        }
      }
    );

    this.loadPinnedMessages();

    this.messageSubject.pipe(
      distinctUntilChanged(),
      switchMap(message => {
        const trimmedMessage = message.trim();
        const hasContent = trimmedMessage.length > 0;
        
        // Si le statut d'écriture n'a pas changé, ne rien envoyer
        if (this.lastSentStatus === hasContent) {
          return EMPTY;
        }
    
        // Si c'est la première lettre ou on passe de 1 à 0 caractère
        if ((this.isFirstLetter && hasContent) || 
            (this.lastMessageLength > 0 && !hasContent)) {
          this.isFirstLetter = false;
          this.lastMessageLength = trimmedMessage.length;
          this.lastSentStatus = hasContent;
          return of(hasContent);
        }
    
        // Pour les lettres suivantes
        this.lastMessageLength = trimmedMessage.length;
        return of(hasContent).pipe(
          debounceTime(300)
        );
      })
    ).subscribe(isWriting => {
      if (!this.solana.session?.id) {
        console.error('User not authenticated');
        return;
      }
    
      const obj: any = {
        type: 'writing_user',
        coinId: this.coinId,
        token: this.solana.tokenService.getToken(),
        isWriting
      }
    
      this.chatService.sendMessage(obj);
    
      // Réinitialiser quand on arrête d'écrire
      if (!isWriting) {
        this.isFirstLetter = true;
        this.lastMessageLength = 0;
      }
    });


    if (this.solana._isInitialized.getValue()) {
      this.initializeChat();
    } else {
      this.initializationSubscription = this.solana.isInitialized$
        .pipe(
          filter(init => init === true),
          take(1)
        )
        .subscribe(() => {
          this.initializeChat();
        });
    }

    this.isInitialLoad = false;

  }


  toggleActionMenu(messageId: string, event: Event): void {
    event.stopPropagation(); // Empêche la propagation du clic

    // Si le menu est déjà ouvert pour ce message, le fermer
    if (this.activeMenuMessageId === messageId) {
      this.activeMenuMessageId = null;
    } else {
      // Sinon, l'ouvrir (et fermer tout autre menu ouvert)
      this.activeMenuMessageId = messageId;
    }
  }

  // Pour fermer tous les menus quand on clique ailleurs
  @HostListener('document:click')
  closeAllMenus(): void {
    this.activeMenuMessageId = null;
  }

  // Fonction like rapide sans ouvrir le menu
  quickLike(message: any, event: Event): void {
    event.stopPropagation(); // Empêche l'ouverture du menu
    this.likeMessage(message);
  }

  handleIsLive(e: any) {
    if (e.type == 'stream_status_update') {
      this.sendEvent.emit({ type: 'stream_status_update', isLive: e?.isLive || false });
    }
  }

  handleViewCount(e: any) {
    if (e.type == 'viewer_count') {
      this.sendEvent.emit({ type: 'viewer_count', count: e?.count.totalCount || 0 });
      this.avatarBottom.bars = e.count.viewers
    }
  }

  handleUserWriting(e: any) {
    const barIndex = this.avatarBottom.bars.findIndex((bar: any) => bar.userId == e.userId);

    if(e.userId == this.solana.session.id && !e.isWriting){
      this.isFirstLetter = true;
      this.lastMessageLength = 0;
      this.lastSentStatus = false;  
    }
    if (barIndex != -1) {
      this.avatarBottom.bars[barIndex].isWriting = e.isWriting;
    }
  }

  handleViewAdd(e: any) {
    if (e.type == 'viewer_add') {
      this.avatarBottom.bars.push(e)
    }
  }
  initializeChat() {
    const token = this.solana.tokenService.getToken() || null;
    this.chatService.connectToCoin(this.coinId, token);

    this.subscription = this.chatService.messages$.subscribe((message: any) => {

      switch (message.type) {
        case 'new_message':
          this.handleNewMessage(message.message);
          break;
        case 'stream_status_update':
          this.handleIsLive(message);
          break;
        case 'viewer_count':
          this.handleViewCount(message);
          break;
        case 'viewer_add':
          this.handleViewAdd(message);
          break;
        case 'like_update':
          this.handleLikeUpdate({
            messageId: message.messageId!,
            likesCount: message.likesCount!,
            isLiked: message.isLiked!,
            userId: message.userId!
          });
          break;
        case 'pin_update':
          this.handlePinUpdate(message.message);
          break;
        case 'message_deleted':
          this.handleMessageDeleted(message.messageId);
          break;
        case 'user_banned':
          this.handleBanNotification(message);
          break;
        case 'user_writing':
          this.handleUserWriting(message)
          break;
      }
    });

    this.loadInitialMessages().then(() => {
      setTimeout(() => {
        this.scrollToBottom();
        this.isInitialLoad = false;
      }, 100);
    });
  }

  handleMessageAction(option: string, message: any): void {
    switch (option) {
      case 'Reply':
        this.replyToMessage(message);
        break;
      case 'Like':
        this.likeMessage(message);
        break;
      case 'Delete':
        this.deleteMessage(message);
        break;
      case 'Pin':
        this.togglePinMessage(message);
        break;
      case 'Ban':
        this.banSelection(message, 'ban');
        break;
    }
  }

  initOption() {
    if (this.role == 'owner') {
      this.optionSettings = ['Ban list', 'Moderator']
    } else {
      this.optionSettings = ['Ban list']
    }
  }

  private handleBanNotification(message: any) {
    if (message.senderId === this.solana.session?.id) {
      const banEndDate = message.banInfo?.expiresAt
        ? new Date(message.banInfo.expiresAt).toLocaleString()
        : 'permanently';

      const banMessage = message.banInfo?.expiresAt
        ? `You have been banned until ${banEndDate}`
        : 'You have been permanently banned';

      const reason = message.banInfo?.reason
        ? `. Reason: ${message.banInfo.reason}`
        : '';


      this.notificationService.showError(`${banMessage}${reason}`);
    }
  }

  private handlePinUpdate(message: any) {
    const existingMessage = this.findMessage(message.id);
    if (existingMessage) {
      existingMessage.isPinned = message.isPinned;
      existingMessage.pinnedBy = message.pinnedBy;
      existingMessage.pinnedAt = message.pinnedAt;
    }
    // Recharger les messages épinglés

    this.pinnedOffset = 0;
    this.hasMorePinnedMessages = true;
    this.loadPinnedMessages();
  }

  togglePinMessage(message: any) {
    if (!this.solana.session?.id) {
      console.error('User not authenticated');
      return;
    }

    const obj = {
      type: 'pin_message',
      messageId: message.id,
      coinId: this.coinId,
      isPinned: !message.isPinned,
      token: this.solana.tokenService.getToken()
    };

    this.chatService.sendMessage(obj);
  }

  settingSelection(e: any) {
    if (e == 'Ban list' && this.role != 'user') {
      this.openBanndedList = true;
    } else if (e == 'Moderator' && this.role == 'owner') {
      this.isModeratorModalOpen = true;
    }

  }

  async onVsChange(event: IPageInfo) {
    // Calculer le pourcentage de scroll
    const scrollPercentage = (event.endIndex + 1) / this.pinnedMessages.length;

    // Si on approche de la fin et qu'il y a plus de messages à charger
    if (scrollPercentage > this.loadingThreshold &&
      !this.isLoadingPinned &&
      this.hasMorePinnedMessages) {
      await this.loadMorePinnedMessages();
    }
  }


  async loadInitialMessages() {
    try {

      const response = await this.chatService.getChatHistory(
        this.coinId,
        this.currentOffset,
        this.pageSize,
        0,
        this.solana.session?.id
      );

      const rawMessages = response.data.messages.reverse().map((msg: any) => ({
        ...msg,
        replies: [],
        isReplyOpen: false,
        isMenuOpen: false
      }));

      this.role = response.data.userRole;
      this.messages = this.groupMessagesBySender(rawMessages);
      this.hasMoreMessages = response.data.hasMore;
      this.currentOffset = response.data.nextOffset;
      this.initOption();
      if (rawMessages.length > 0) {
        this.lastMessageTimestamp = this.messages[0].timestamp;
      }

    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }

  async loadPinnedMessages() {
    if (this.isLoadingPinned || !this.hasMorePinnedMessages) return;

    try {
      this.isLoadingPinned = true;
      const response = await this.chatService.getChatHistoryPinned(
        this.coinId,
        this.pinnedOffset,
        this.pinnedPageSize,
        0,
        this.solana.session?.id
      );

      const newMessages = response.data.messages;

      if (this.pinnedOffset === 0) {
        this.pinnedMessages = newMessages;
      } else {
        this.pinnedMessages = [...this.pinnedMessages, ...newMessages];
      }

      this.hasMorePinnedMessages = response.data.hasMore;
      this.pinnedOffset = response.data.nextOffset;

    } catch (error) {
      console.error('Error loading pinned messages:', error);
    } finally {
      this.isLoadingPinned = false;
    }
  }

  async loadMorePinnedMessages() {
    if (this.hasMorePinnedMessages) {
      await this.loadPinnedMessages();
    }
  }

  togglePinnedMessagesModal() {
    this.showPinnedMessages = !this.showPinnedMessages;
  }

  onScroll(event: any) {
    const elem: HTMLElement = event.target;

    // Empêcher le scroll de dépasser le haut
    if (elem.scrollTop < 1) {
      elem.scrollTop = 1;
    }

    // Si chargement en cours ou plus de messages, on sort
    if (this.isLoading || !this.hasMoreMessages) {
      return;
    }

    // Charger plus quand on est près du haut
    if (elem.scrollTop < 50) {
      this.loadMoreMessages(elem);
    }
  }

  async loadMoreMessages(scrollElement: HTMLElement) {
    this.isLoading = true;
    const previousHeight = scrollElement.scrollHeight;
    const previousScrollPosition = scrollElement.scrollTop;

    try {
      const response = await this.chatService.getChatHistory(
        this.coinId,
        this.currentOffset,
        this.pageSize,
        this.lastMessageTimestamp,
        this.solana.session?.id
      );

      const rawMessages = response.data.messages.reverse().map((msg: any) => ({
        ...msg,
        replies: [],
        isReplyOpen: false,
        isMenuOpen: false
      }));

      // Ajouter les nouveaux messages au début
      const newMessages = this.groupMessagesBySender(rawMessages);
      this.messages = [...newMessages, ...this.messages];

      this.hasMoreMessages = response.data.hasMore;
      this.currentOffset = response.data.nextOffset;

      if (rawMessages.length > 0) {
        this.lastMessageTimestamp = this.messages[0].timestamp;
      }

      // Maintenir la position du scroll
      setTimeout(() => {
        const newHeight = scrollElement.scrollHeight;
        const heightDifference = newHeight - previousHeight;
        scrollElement.scrollTop = previousScrollPosition + heightDifference;
      });

    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setTimeout(() => {
        this.isLoading = false;
      }, 200);
    }
  }

  scrollToBottom() {
    if (this.chatscroll) {
      const element = this.chatscroll.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  private groupMessagesBySender(messages: any[]): any[] {
    const groups: any[] = [];
    let currentGroup: any | null = null;

    messages.forEach((message) => {
      if (!currentGroup || currentGroup.senderId !== message.sender.id) {
        // Créer un nouveau groupe
        currentGroup = {
          senderId: message.sender.id,
          sender: message.sender,
          messages: [message]
        };
        groups.push(currentGroup);
      } else {
        // Ajouter au groupe existant
        currentGroup.messages.push(message);
      }
    });

    return groups;
  }

  private handleNewMessage(message: any) {

    // Préparer le nouveau message
    const newMessage = {
      ...message,
      replies: [],
      isReplyOpen: false,
      isMenuOpen: false
    };


    const existingGroup = this.messages.find(group => group.senderId === message.sender.id);
    if (existingGroup && this.messages[this.messages.length - 1].senderId === message.sender.id) {
      // Ajouter au groupe existant
      this.messages[this.messages.length - 1].messages.push(newMessage);
    } else {
      // Créer un nouveau groupe
      const newGroup = {
        senderId: message.sender.id,
        sender: message.sender,
        messages: [newMessage]
      };
      this.messages.push(newGroup);
    }


    // Scroll vers le bas après l'ajout du message
    setTimeout(() => {
      this.scrollToBottom();
    });

  }

  private handleLikeUpdate(update: {
    messageId: number,
    likesCount: number,
    isLiked: boolean,
    userId: string
  }) {
    const message = this.findMessage(update.messageId);
    if (message) {
      message.likesCount = update.likesCount;
      message.isLiked = update.isLiked;

      // Si vous gardez une liste des utilisateurs qui ont liké
      if (update.isLiked) {
        // Ajouter l'utilisateur à la liste des likes
        if (!message.likedBy) {
          message.likedBy = [];
        }
        if (!message.likedBy.includes(update.userId)) {
          message.likedBy.push(update.userId);
        }
      } else {
        // Retirer l'utilisateur de la liste des likes
        if (message.likedBy) {
          message.likedBy = message.likedBy.filter((id: any) => id !== update.userId);
        }
      }
    }
  }

  private findMessage(messageId: number): any | null {
    // Parcourir chaque groupe
    for (const group of this.messages) {
      // Chercher dans les messages du groupe
      const message = group.messages.find((m: any) => m.id === messageId);
      if (message) return message;

      // Chercher dans les réponses de chaque message du groupe
      for (const groupMessage of group.messages) {
        if (groupMessage.replies && groupMessage.replies.length > 0) {
          const reply = groupMessage.replies.find((r: any) => r.id === messageId);
          if (reply) return reply;
        }
      }
    }
    return null;
  }

  sendMessage() {
    if (!this.solana.session?.id) {
      console.error('User not authenticated');
      return;
    }

    const obj: any = {
      type: 'message',
      coinId: this.coinId,
      content: this.newMessage,
      timestamp: Date.now(),
      parentMessageId: this.replyingTo?.id,
      token: this.solana.tokenService.getToken()
    }

    if (this.newMessage.trim()) {
      this.chatService.send(obj);
      this.newMessage = '';
      if (this.replyingTo) {
        this.replyingTo = null;
      }
      this.isFirstLetter = true;
      this.lastMessageLength = 0;
      this.lastSentStatus = false;
      setTimeout(() => {
        this.scrollToBottom();
      });
    }
  }

  toggleMenu(message: any) {
    this.messages.forEach(msg => {
      if (msg !== message) msg.isMenuOpen = false;
      if (msg.replies) {
        msg.replies.forEach((reply: any) => {
          if (reply !== message) reply.isMenuOpen = false;
        });
      }
    });
    message.isMenuOpen = !message.isMenuOpen;
  }

  likeMessage(message: any) {
    if (!this.solana.session?.id) {
      console.error('User not authenticated');
      return;
    }

    const obj: any = {
      type: 'like_message',
      messageId: message.id,
      coinId: this.coinId,
      token: this.solana.tokenService.getToken()
    }

    this.chatService.sendMessage(obj);
  }

  replyToMessage(message: any) {
    this.messages.forEach(msg => {
      if (msg !== message) msg.isReplyOpen = false;
    });

    this.replyingTo = message;
    message.isReplyOpen = true;
  }

  cancelReply() {
    if (this.replyingTo) {
      this.replyingTo.isReplyOpen = false;
      this.replyingTo = null;
    }
  }

  formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  isUserMessage(senderId: string): boolean {
    return senderId === this.solana.session?.id;
  }

  onInputChange() {
    this.messageSubject.next(this.newMessage);
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    if (this.initializationSubscription) {
      this.initializationSubscription.unsubscribe();
    }
    this.chatService.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
    this.loadMoreSubject.complete();
    this.messageSubject.complete();
    this.isFirstLetter = true;
    this.lastMessageLength = 0;
    this.lastSentStatus = false;


  }

  deleteMessage(message: any) {
    if (!this.solana.session?.id) {
      console.error('User not authenticated');
      return;
    }

    const obj: any = {
      type: 'delete_message',
      messageId: message.id,
      coinId: this.coinId,
      token: this.solana.tokenService.getToken()
    };

    this.chatService.sendMessage(obj);
  }

  banUser(message: any, duration?: number) {
    if (!this.solana.session?.id) {
      console.error('User not authenticated');
      return;
    }

    const obj: any = {
      type: 'ban_user',
      targetUserId: message.sender.id,
      coinId: this.coinId,
      reason: 'Violation of chat rules', // Vous pouvez ajouter un input pour la raison
      duration: duration, // en minutes
      token: this.solana.tokenService.getToken()
    };

    this.chatService.sendMessage(obj);

    this.deleteMessage(message);
  }

  banSelection(message: any, e: any) {
    this.banUser(message, e.value)
  }

  private handleMessageDeleted(messageId: number) {
    this.messages = this.messages.map(group => {
      group.messages = group.messages.filter((msg: any) => msg.id !== messageId);
      return group;
    });
    this.messages = this.messages.filter(group => group.messages.length > 0);
  }

}
function firstValueFrom(arg0: Observable<boolean>) {
  throw new Error('Function not implemented.');
}

