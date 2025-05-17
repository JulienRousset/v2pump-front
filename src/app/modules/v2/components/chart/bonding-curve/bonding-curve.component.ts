import { Component, Input, OnInit } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Connection, PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { throttleTime } from 'rxjs/operators';

interface PumpCurveState {
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  realTokenReserves: bigint;
  realSolReserves: bigint;
  tokenTotalSupply: bigint;
  complete: boolean;
  solPrice: number;
}

@Component({
  selector: 'app-bonding-curve',
  templateUrl: './bonding-curve.component.html',
  styleUrls: ['./bonding-curve.component.scss'],
  
})
export class BondingCurveComponent implements OnInit {
  private readonly RPC_ENDPOINT = 'https://wandering-billowing-moon.solana-mainnet.quiknode.pro/da55f32e52d1b381b8dc20e71c097aa7d184cbe0';
  private readonly PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
  private readonly PUMP_CURVE_STATE_SIGNATURE = Buffer.from([0x17, 0xb7, 0xf8, 0x37, 0x60, 0xd8, 0xac, 0x60]);
  private readonly PUMP_CURVE_STATE_SIZE = 0x29;
  private readonly LAMPORTS_PER_SOL = 1_000_000_000n;
  private readonly KING_OF_THE_HILL_MARKET_CAP = new BehaviorSubject<number>(0);
  private readonly KING_OF_THE_HILL_THRESHOLD = BigInt(200_000_000_000); // 200 SOL en lamports

  private readonly PUMP_CURVE_STATE_OFFSETS = {
    VIRTUAL_TOKEN_RESERVES: 0x08,
    VIRTUAL_SOL_RESERVES: 0x10,
    REAL_TOKEN_RESERVES: 0x18,
    REAL_SOL_RESERVES: 0x20,
    TOKEN_TOTAL_SUPPLY: 0x28,
    COMPLETE: 0x30,
  };

  @Input() coinId: string = '';
  @Input() token: any;
  mcapKing: any;
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
      this.triggerUpdate();
    }
  }
  get curve(): any {
    return this._curve;
  }
  private _curve: any = 0;
  private updateSubject = new Subject<void>();
  private isUpdating = false;
  private updateQueued = false;
  private readonly THROTTLE_DELAY = 0;

  private connection: Connection;
  public progressPercentage = new BehaviorSubject<number>(0);
  public targetMarketCap = new BehaviorSubject<number>(0);
  public state: any
  public lastUpdateTime: any;


  constructor() {
    this.connection = new Connection(this.RPC_ENDPOINT);

    this.updateSubject.pipe(
      throttleTime(this.THROTTLE_DELAY, undefined, { leading: true, trailing: false })
    ).subscribe(() => {
      this.processUpdate();
    });
  }

  async ngOnInit() {
    if (this.curve) {
      await this.checkCurveProgress();
    }
  }

  // Ajoutez cette méthode pour calculer la progression du King of the Hill
  private calculateKingOfTheHillProgress(state: PumpCurveState): void {
    try {

      // Calcul du solde actuel en SOL
      const totalTokens = state.tokenTotalSupply;
      const currentSolReserves = state.virtualSolReserves;
      const virtualReserves = state.virtualTokenReserves;

      if (virtualReserves === BigInt(0)) {
        this.KING_OF_THE_HILL_MARKET_CAP.next(0);
        return;
      }

      // Calcul du Market Cap actuel en SOL
      const currentMarketCapSOL = (totalTokens * currentSolReserves) / virtualReserves;

      // Conversion en USD
      const currentMarketCapUSD = Number(currentMarketCapSOL) / Number(this.LAMPORTS_PER_SOL) * state.solPrice;

      // Calcul du Market Cap cible pour King of the Hill en USD
      const targetKingMarketCapUSD = Number(this.KING_OF_THE_HILL_THRESHOLD) / Number(this.LAMPORTS_PER_SOL) * state.solPrice;

      // Calcul de la progression en pourcentage
      const progress = Math.min((currentMarketCapUSD / targetKingMarketCapUSD) * 100, 100);

      console.log('King of the Hill Progress Calculation:');
      console.log('Current Market Cap USD:', this.formatUSD(currentMarketCapUSD));
      console.log('Target King Market Cap USD:', this.formatUSD(targetKingMarketCapUSD));
      console.log('Progress:', progress.toFixed(2), '%');

      this.mcapKing = targetKingMarketCapUSD
      this.KING_OF_THE_HILL_MARKET_CAP.next(progress);
    } catch (error) {
      console.error('Error calculating King of the Hill progress:', error);
      this.KING_OF_THE_HILL_MARKET_CAP.next(0);
    }
  }

  // Modifiez getPumpCurveState pour inclure le nouveau calcul

  // Ajoutez cette méthode getter pour accéder à la progression King of the Hill
  getKingOfTheHillProgress(): Observable<number> {
    return this.KING_OF_THE_HILL_MARKET_CAP.asObservable();
  }

  private async processUpdate() {
    // Si déjà en cours de mise à jour, on marque qu'une mise à jour est en attente
    if (this.isUpdating) {
      this.updateQueued = true;
      return;
    }

    try {
      this.isUpdating = true;

      if (this.curve) {
        await this.checkCurveProgress();
        this.calculateProgress(this.curve);
        this.calculateTargetMarketCap(this.curve);
      }
    } catch (error) {
      console.error('Error updating components:', error);
    } finally {
      this.isUpdating = false;

      if (this.updateQueued) {
        this.updateQueued = false;
        setTimeout(() => {
          this.processUpdate();
        }, this.THROTTLE_DELAY);
      }
    }
  }

  private triggerUpdate() {
    console.log('Update triggered:', new Date().toISOString());
    this.updateSubject.next();
  }

  private calculateBondingCurveProgress(realTokenReserves: bigint, tokenTotalSupply: bigint): number {
    const realReserves = Number(realTokenReserves) / (10 ** 6);
    const totalSupply = Number(tokenTotalSupply) / (10 ** 6);

    if (realReserves < 0 || totalSupply <= 0) {
      throw new Error("Les réserves doivent être positives");
    }

    const progress = 100 - ((realReserves * 100) / totalSupply);
    return Number(progress.toFixed(2));
  }

  private calculateSolNeeded(amount: bigint, state: PumpCurveState): bigint {
    if (amount === 0n) return 0n;

    amount = amount < state.realTokenReserves ? amount : state.realTokenReserves;
    return (amount * state.virtualSolReserves) /
      (state.virtualTokenReserves - amount) + 1n;
  }

  private calculateTargetMarketCap(state: PumpCurveState): void {
    try {
      if (!state ||state.solPrice <= 0) {
        this.targetMarketCap.next(0);
        return;
      }

      const solNeeded = this.calculateSolNeeded(
        state.realTokenReserves,
        state
      );

      const finalSolReserves = state.virtualSolReserves + solNeeded;
      const remainingVirtualTokens = state.virtualTokenReserves - state.realTokenReserves;

      if (remainingVirtualTokens === 0n) {
        this.targetMarketCap.next(0);
        return;
      }

      const marketCapSOL = (state.tokenTotalSupply * finalSolReserves) / remainingVirtualTokens;
      const marketCapUSD = Number(marketCapSOL) / Number(this.LAMPORTS_PER_SOL) * state.solPrice;

      // Réduction de 7% du marketcap final
      const finalMarketCap = marketCapUSD - (marketCapUSD * 0.00);

      this.targetMarketCap.next(finalMarketCap);
      console.log('Target Market Cap:', this.formatUSD(finalMarketCap));
    } catch (error) {
      console.error('Error calculating target market cap:', error);
      this.targetMarketCap.next(0);
    }
  }

  private calculateProgress(state: PumpCurveState): void {
    try {
      const progress = this.calculateBondingCurveProgress(
        state.realTokenReserves,
        state.tokenTotalSupply
      );

      console.log('Progress:', progress, '%');
      this.progressPercentage.next(progress);
    } catch (error) {
      console.error('Error calculating bonding curve progress:', error);
      this.progressPercentage.next(0);
    }
  }

  // Dans votre composant Angular
  async checkCurveProgress(): Promise<void> {
    try {
    
      this.calculateProgress(this.curve)
      this.calculateTargetMarketCap(this.curve)
      this.calculateKingOfTheHillProgress(this.curve)
  
    } catch (error) {
      console.error('Error checking curve progress:', error)
      throw error
    }
  }


  formatUSD(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  }

  getProgress(): Observable<number> {
    return this.progressPercentage.asObservable();
  }

  getTargetMarketCap(): Observable<number> {
    return this.targetMarketCap.asObservable();
  }

  ngOnDestroy() {
    this.updateSubject.complete();
  }
}
