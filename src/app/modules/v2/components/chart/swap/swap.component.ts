import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Connection, PublicKey, LAMPORTS_PER_SOL, TransactionMessage, SystemProgram, Transaction, ComputeBudgetProgram, VersionedTransaction, Keypair } from '@solana/web3.js';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { SolanaService } from '@shared/services/solana.service';
import { PumpFunService } from 'src/app/pump-fun.service';
import { JupiterService } from 'src/app/jupiter.service';
import { debounceTime, switchMap } from 'rxjs/operators';
import BN from 'bn.js';
import { animate, style, transition, trigger } from '@angular/animations';
import { EventsService } from 'src/app/events.service';
import { NotificationService } from 'src/app/notification.service';

interface Token {
  symbol: string;
  name: string;
  logoURI: string;
  address: string;
  source: string;
  decimals: number;
  balance?: number;
  type?: string;
}

@Component({
  selector: 'app-swap',
  templateUrl: './swap.component.html',
  styleUrls: ['./swap.component.scss'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class SwapComponent implements OnInit, OnDestroy {
  @Input() coinId: string = '';
  @Input() token!: Token;

  settings = {
    slippageTolerance: 15, // default value (basis points)
    networkFee: 0.003,     // default value
    priorityTip: 0.0001    // default value
  };

  settingsForm: FormGroup | any;
  isConnected: boolean = false;
  currentWalletAddress: string = '';
  swapForm: FormGroup | any;
  tradeType: 'buy' | 'sell' = 'buy';
  solBalance: number = 0;
  tokenBalance: number = 0;
  selectedAmount: number = 0.2;
  isLoading: boolean = false;
  estimatedPrice: number = 0;
  priceImpact: number = 0;
  minimumReceived: number = 0;
  currentQuote: any = null;
  tradeTypes: ('buy' | 'sell')[] = ['buy', 'sell'];
  quickAmounts = [0.2, 0.5, 1];
  saveAmount: number = 0;
  quickAmountSell = [25, 50, 100]; // Represents percentages for sell mode
  openModal = false;
  loadingSwap = false;
  transactionInProgress = false;
  baseNetworkFee: number = 0.0005; // Base Solana network fee
  selectedFeeLevel: string = 'High';
  networkFeeLevels: any = [
    { name: 'Best', multiplier: 1, successRate: 75 },
    { name: 'High', multiplier: 2, successRate: 95 },
    { name: 'Extreme', multiplier: 4, successRate: 99 }
  ];

  private priceCache: Map<string, { price: number, timestamp: number }> = new Map();
  private priceSubscription?: Subscription;
  private formSubscription?: Subscription;
  private walletSubscription?: Subscription;
  private balanceSubscription?: Subscription;
  private addressSubscription?: Subscription;
  private transactionSubscription?: Subscription;

  @Input() set curve(value: any) {
    if (value && value !== this.curve) {
      value = {
        ...value,
        virtualTokenReserves: BigInt(value.virtualTokenReserves),
        virtualSolReserves: BigInt(value.virtualSolReserves),
        realTokenReserves: BigInt(value.realTokenReserves),
        realSolReserves: BigInt(value.realSolReserves),
        tokenTotalSupply: BigInt(value.tokenTotalSupply)
      }
      this._curve = value;
    }
  }

  get curve(): any {
    return this._curve;
  }

  private _curve: any = 0;

  constructor(
    public solanaService: SolanaService,
    private fb: FormBuilder,
    private http: HttpClient,
    private pumpFunService: PumpFunService,
    public jupiterService: JupiterService,
    private eventsService: EventsService,
    private notificationService: NotificationService
  ) {
    this.initForm();
    this.initSettingsForm();
  }

  private initForm() {
    this.swapForm = this.fb.group({
      amount: ['', [
        Validators.min(0.000001),
        (control: any) => this.validateAmount(control.value)
      ]],
      expectedAmount: ['']
    });
  }

  saveSettings() {
    if (this.settingsForm.valid) {
      this.settings = {
        slippageTolerance: this.settingsForm.value.slippageTolerance,
        networkFee: this.settingsForm.value.networkFee,
        priorityTip: this.settingsForm.value.priorityTip
      };

      // Recalculate expected amount with new parameters
      if (this.swapForm.get('amount')?.value) {
        this.calculateExpectedAmount(this.swapForm.get('amount')?.value);
      }

      this.openModal = false;
    }
  }

  async checkCurve(mintAddress: string): Promise<void> {
    try {
      const response = await fetch('http://127.0.0.1:3000/coin/bonding?refresh=true&mint=' + mintAddress, {
        method: 'get'
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      this.curve = result.data;
    } catch (error) {
      console.error('Error checking curve progress:', error);
      this.notificationService.showError('Failed to fetch token curve data');
      throw error;
    }
  }

  resetSettings() {
    this.settingsForm.patchValue({
      slippageTolerance: 1,
      networkFee: 0.000005,
      priorityTip: 0.01
    });
  }

  private initSettingsForm() {
    this.settingsForm = this.fb.group({
      slippageTolerance: [this.settings.slippageTolerance, [Validators.required, Validators.min(0.1), Validators.max(100)]],
      networkFee: [this.settings.networkFee, [Validators.required, Validators.min(0.000001)]],
      priorityTip: [this.settings.priorityTip, [Validators.required, Validators.min(0)]]
    });
  }

  async fetchCurrentNetworkFee() {
    this.isLoading = true;
    try {
      // Get the most recent blockhash
      const { blockhash } = await this.solanaService.connection.getLatestBlockhash('confirmed');

      // Generate random public keys for 'from' and 'to'
      const dummyFrom = Keypair.generate().publicKey;
      const dummyTo = Keypair.generate().publicKey;

      // Create transfer instruction
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: dummyFrom,
        toPubkey: dummyTo,
        lamports: 1000,
      });

      // Create a v0 message
      const messageV0 = new TransactionMessage({
        payerKey: dummyFrom,
        recentBlockhash: blockhash,
        instructions: [transferInstruction]
      }).compileToV0Message();

      // Create a versioned transaction
      const transaction = new VersionedTransaction(messageV0);

      // Get fees
      const response = await this.solanaService.connection.getFeeForMessage(messageV0, 'confirmed');

      if (!response?.value) {
        throw new Error('Failed to get fee');
      }

      // Convert fees to SOL
      this.baseNetworkFee = response.value / LAMPORTS_PER_SOL;

      // Update form with new base fees
      const currentLevel = this.networkFeeLevels.find((l: any) => l.name === this.selectedFeeLevel);
      if (currentLevel) {
        this.setNetworkFeeLevel(currentLevel);
      }
    } catch (error) {
      console.error('Error fetching network fee:', error);
      // Revert to default fees in case of error
      this.baseNetworkFee = 0.0005;
    } finally {
      this.isLoading = false;
    }
  }

  // Function to add priority fee (optional)
  addPriorityFee(transaction: Transaction, microLamports: number) {
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports,
      })
    );
  }

  setNetworkFeeLevel(level: any) {
    this.selectedFeeLevel = level.name;
    const calculatedFee = this.baseNetworkFee * level.multiplier;
    this.settingsForm.patchValue({
      networkFee: calculatedFee
    });
  }

  getSuccessRate(levelName: string): number {
    const level = this.networkFeeLevels.find((l: any) => l.name === levelName);
    return level ? level.successRate : 75;
  }

  async ngOnInit() {
    // Subscribe to wallet connection status
    this.walletSubscription = this.solanaService.isConnected$.subscribe(
      async (isConnected: boolean) => {
        this.isConnected = isConnected;
        if (isConnected) {
          await this.updateBalances();
        } else {
          this.solBalance = 0;
          this.tokenBalance = 0;
        }
      });

    // Subscribe to wallet balance changes
    this.balanceSubscription = this.solanaService.balance$.subscribe(
      (balance: number) => {
        this.solBalance = balance;
      }
    );

    // Subscribe to transaction finalization events
    this.transactionSubscription = this.eventsService.transactionFinalized$.subscribe((signature: string) => {
      this.updateBalances();
      this.loadingSwap = false;
      this.transactionInProgress = false;
    });

    // Subscribe to wallet address changes
    this.addressSubscription = this.solanaService.session$.subscribe(
      (address: string) => {
        this.currentWalletAddress = address;
        this.updateBalances();
      }
    );

    // Subscribe to form value changes
    this.formSubscription = this.swapForm.get('amount')?.valueChanges
      .pipe(debounceTime(500))
      .subscribe(async (value: any) => {
        if (value) {
          await this.calculateExpectedAmount(value);
        }
      });

    await this.updateBalances();
    await this.fetchCurrentNetworkFee();
    this.setNetworkFeeLevel({ name: 'Best', multiplier: 1, successRate: 75 });
    this.settings.networkFee = this.settingsForm.value.networkFee;
  }

  async executeSwap() {
    if (!this.isConnected || !this.currentQuote || this.transactionInProgress) {
      return;
    }

    try {
      this.isLoading = true;
      this.transactionInProgress = true;
      this.loadingSwap = true;

      const amount = this.swapForm.get('amount').value;
      const slippageBps = this.settings.slippageTolerance * 100; // Convert to basis points
      const slippageDecimal = this.settings.slippageTolerance / 100; // Convert to decimal (0.01 for 1%)
      const priorityFee = this.settings.priorityTip;
      const gazFee = this.settings.networkFee;

      let result;

      if (this.tradeType === 'buy') {
        if (this.token.source === 'https://pump.fun') {
          // Refresh curve data
          await this.checkCurve(this.coinId);
          await this.pumpFunService.initializeBondingCurve(this.curve);

          // Use the retry version for PumpFun buy
          result = await this.pumpFunService.pumpFunBuyWithRetry(
            this.coinId,
            amount,
            priorityFee,
            slippageDecimal,
            gazFee
          );

        } else {
          // For Jupiter swaps, use the retry version
          const amountInLamports = Math.floor(amount * LAMPORTS_PER_SOL);
          result = await this.jupiterService.buy(
            "So11111111111111111111111111111111111111112",
            this.coinId,
            amountInLamports,
            slippageBps,
            priorityFee);

        }
      } else {
        // Sell logic
        if (this.token.source === 'https://pump.fun') {
          // Refresh curve data
          await this.checkCurve(this.coinId);
          await this.pumpFunService.initializeBondingCurve(this.curve);

          // Use the retry version for PumpFun sell
          const tokenAmount = Math.floor(amount * Math.pow(10, this.token.decimals));
          result = await this.pumpFunService.pumpFunSellWithRetry(
            this.coinId,
            tokenAmount,
            priorityFee,
            slippageDecimal,
            gazFee
          );
        } else {
          // For Jupiter sells, use the retry version
          const amountInTokens = Math.floor(amount * Math.pow(10, this.token.decimals));
          result = await this.jupiterService.sell(
            this.coinId,
            "So11111111111111111111111111111111111111112",
            amountInTokens,
            slippageBps
            , priorityFee);
        }
      }

      if (result && result.confirmed) {
        this.notificationService.showSuccess('Transaction submitted! You can safely navigate away.');
        this.swapForm.reset();
      } else {
        this.notificationService.showError('Transaction may have failed. Please check your wallet.');
        this.loadingSwap = false;
        this.transactionInProgress = false;
      }

    } catch (error: any) {
      console.error('Swap failed:', error);
      this.notificationService.showError(error.message || 'Transaction failed. Please try again.');
      this.loadingSwap = false;
      this.transactionInProgress = false;
    } finally {
      this.isLoading = false;
    }
  }

  async calculateExpectedAmount(amount: number) {
    try {
      if (!amount || isNaN(amount) || amount <= 0) {
        this.swapForm.patchValue({ expectedAmount: '' }, { emitEvent: false });
        this.currentQuote = null;
        this.priceImpact = 0;
        this.minimumReceived = 0;
        return;
      }

      this.saveAmount = amount;
      const slippageBps = Math.floor(this.settings.slippageTolerance * 100); // Convert to basis points

      if (this.token.source === 'https://pump.fun') {
        // PumpFun logic
        await this.pumpFunService.initializeBondingCurve(this.curve);

        if (this.tradeType === 'buy') {
          const solInBN = new BN(Math.floor(amount * LAMPORTS_PER_SOL));
          const quote = await this.pumpFunService.getBuyQuote(solInBN);

          if (quote) {
            const expectedAmount = Number(quote.amountOut) / Math.pow(10, this.token.decimals);
            this.swapForm.patchValue({ expectedAmount }, { emitEvent: false });
            this.currentQuote = quote;
            this.priceImpact = quote.priceImpact;
            this.minimumReceived = Number(quote.minAmountOut) / Math.pow(10, this.token.decimals);
          }
        } else {
          // For sell mode, we convert percentage to actual amount
          const tokenAmount = Math.floor(amount * Math.pow(10, this.token.decimals));
          const quote = await this.pumpFunService.getSellQuote(new BN(tokenAmount));

          if (quote) {
            const expectedAmount = Number(quote.amountOut) / LAMPORTS_PER_SOL;
            this.swapForm.patchValue({ expectedAmount }, { emitEvent: false });

            const oneSolQuote: any = await this.jupiterService.getQuote(
              "So11111111111111111111111111111111111111112",
              this.coinId,
              LAMPORTS_PER_SOL,
              slippageBps
            );
            const pricePerSol = Number(oneSolQuote.outAmount) / Math.pow(10, this.token.decimals);
            this.currentQuote = {
              ...quote,
              pricePerSol, // Price for 1 SOL in tokens
              expectedAmount // Expected amount in SOL
            };
            this.priceImpact = quote.priceImpact;
            this.minimumReceived = Number(quote.minAmountOut) / LAMPORTS_PER_SOL;
          }
        }
      } else {
        // Jupiter logic
        const inputMint = this.tradeType === 'buy'
          ? "So11111111111111111111111111111111111111112"
          : this.coinId;

        const outputMint = this.tradeType === 'buy'
          ? this.coinId
          : "So11111111111111111111111111111111111111112";

        const amountInSmallestUnit = this.tradeType === 'buy'
          ? Math.floor(amount * LAMPORTS_PER_SOL)
          : Math.floor(amount * Math.pow(10, this.token.decimals));

        const quote: any = await this.jupiterService.getQuote(
          inputMint,
          outputMint,
          amountInSmallestUnit,
          slippageBps
        );

        if (quote) {
          const outputDecimals = this.tradeType === 'buy'
            ? this.token.decimals
            : 9; // SOL decimals

          const expectedAmount = Number(quote.outAmount) / Math.pow(10, outputDecimals);
          this.swapForm.patchValue({ expectedAmount }, { emitEvent: false });

          const oneSolQuote: any = await this.jupiterService.getQuote(
            "So11111111111111111111111111111111111111112",
            this.coinId,
            LAMPORTS_PER_SOL,
            slippageBps
          );

          const pricePerSol = Number(oneSolQuote.outAmount) / Math.pow(10, this.token.decimals);
          this.currentQuote = {
            ...quote,
            pricePerSol, // Price for 1 SOL in tokens
            expectedAmount // Expected amount
          };
          this.priceImpact = quote.priceImpactPct;
          this.minimumReceived = expectedAmount * (1 - slippageBps / 10000);
        }
      }
    } catch (error) {
      console.error('Error calculating expected amount:', error);
      this.swapForm.patchValue({ expectedAmount: '' }, { emitEvent: false });
      this.currentQuote = null;
      this.priceImpact = 0;
      this.minimumReceived = 0;
    }
  }

  async updateBalances() {
    try {
      if (!this.currentWalletAddress) {
        this.solBalance = 0;
        this.tokenBalance = 0;
        return;
      }

      const publicKey = new PublicKey(this.currentWalletAddress);

      // Get SOL balance - This is actually handled by the subscription now,
      // but keeping it for initial load
      const solBalanceInLamports = await this.solanaService.connection.getBalance(publicKey);
      this.solBalance = solBalanceInLamports / LAMPORTS_PER_SOL;

      // Get token balance
      if (this.coinId) {
        try {
          const response = await this.solanaService.connection.getTokenAccountsByOwner(
            publicKey,
            { mint: new PublicKey(this.coinId) }
          );

          if (response.value.length > 0) {
            const accountInfo = response.value[0].account.data;
            const balance = Number(accountInfo.slice(64, 72).readBigUInt64LE()) / Math.pow(10, this.token.decimals);
            this.tokenBalance = balance;
          } else {
            this.tokenBalance = 0;
          }
        } catch (error) {
          console.error('Error fetching token balance:', error);
          this.tokenBalance = 0;
        }
      }
    } catch (error) {
      console.error('Error updating balances:', error);
      this.solBalance = 0;
      this.tokenBalance = 0;
    }
  }

  async onAmountChange(event: any) {
    const amount = event.target.value;

    if (this.tradeType === 'sell' && this.tokenBalance > 0) {
      // Calculate percentage for sell mode
      const percentage = (amount / this.tokenBalance) * 100;
      // Update selected amount if it's one of the quick percentages
      if (this.quickAmountSell.includes(Math.round(percentage))) {
        this.selectedAmount = Math.round(percentage);
      } else {
        this.selectedAmount = 0;
      }
    } else {
      // Buy mode - existing behavior
      if (this.quickAmounts.includes(Number(amount))) {
        this.selectedAmount = Number(amount);
      } else {
        this.selectedAmount = 0;
      }
    }

    if (amount && !isNaN(amount) && amount > 0) {
      await this.calculateExpectedAmount(amount);
    } else {
      this.swapForm.patchValue({ expectedAmount: '' }, { emitEvent: false });
      this.currentQuote = null;
      this.priceImpact = 0;
      this.minimumReceived = 0;
    }
  }

  async setTradeType(type: 'buy' | 'sell') {
    this.tradeType = type;
    const currentAmount = this.swapForm.get('amount')?.value;
    this.swapForm.patchValue({ expectedAmount: '' }, { emitEvent: false });

    if (currentAmount && !isNaN(currentAmount)) {
      await this.calculateExpectedAmount(currentAmount);
    }
  }

  async setQuickAmount(percentage: number) {
    this.selectedAmount = percentage;

    if (this.tradeType === 'sell') {
      // Calculate amount based on percentage of token balance
      const amount = (percentage / 100) * this.tokenBalance;
      this.swapForm.patchValue({ amount }, { emitEvent: true });
    } else {
      // Buy mode - use fixed amounts as before
      this.swapForm.patchValue({ amount: percentage }, { emitEvent: true });
    }
  }

  validateAmount(amount: number): { [key: string]: any } | null {
    if (!amount) return null;
    if (isNaN(amount)) return { notANumber: true };
    if (amount <= 0) return { positive: true };

    const maxAmount = this.tradeType === 'buy' ? this.solBalance : this.tokenBalance;
    if (amount > maxAmount) return { insufficientBalance: true };

    return null;
  }

  formatPrice(value: number): string {
    if (!value || isNaN(value)) return '0';

    if (value < 0.0001) return value.toExponential(4);
    if (value < 1) return value.toFixed(6);
    if (value > 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value > 1000) return `${(value / 1000).toFixed(2)}K`;

    return value.toFixed(2);
  }

  formatImpact(value: number) {
    if (!value || isNaN(value)) return '0';
    return value.toFixed(2) + '%';
  }

  formatMinimumReceived(value: number): string {
    if (!value || isNaN(value)) return '0';

    if (value < 0.0001) return value.toExponential(4);
    if (value < 1) return value.toFixed(6);

    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(value);
  }

  getActionButtonText(): string {
    if (!this.isConnected) return 'Connect Wallet';
    if (this.loadingSwap) return 'Transaction in progress...';
    if (this.isLoading) return 'Calculating...';

    const amountControl = this.swapForm.get('amount');

    if (!amountControl?.value) return 'Enter an amount';
    if (amountControl?.errors?.['notANumber']) return 'Invalid amount';
    if (amountControl?.errors?.['positive']) return 'Amount must be positive';
    if (amountControl?.errors?.['insufficientBalance']) return 'Insufficient balance';
    if (!this.currentQuote) return 'Calculating price...';

    return `${this.tradeType === 'buy' ? 'Buy' : 'Sell'} ${this.token?.symbol}`;
  }

  isActionButtonDisabled(): boolean {
    return this.loadingSwap ||
      this.isLoading ||
      !this.isConnected ||
      !this.swapForm.get('amount')?.value ||
      this.swapForm.invalid ||
      !this.currentQuote ||
      this.transactionInProgress;
  }

  getCurrencyIcon(): string {
    return this.tradeType === 'buy'
      ? '/assets/solana-logo.png'
      : this.token.logoURI;
  }

  ngOnDestroy() {
    this.priceSubscription?.unsubscribe();
    this.formSubscription?.unsubscribe();
    this.walletSubscription?.unsubscribe();
    this.addressSubscription?.unsubscribe();
    this.transactionSubscription?.unsubscribe();
    this.balanceSubscription?.unsubscribe();
  }
}
