import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, of } from "rxjs";
import {
    BeardShape, ClothesShape, EarringsShape, EarShape, EyebrowsShape,
    EyesShape, FaceShape, GlassesShape, MouthShape, NoseShape, TopsShape
} from "../models/enums";
import { map, shareReplay, catchError } from "rxjs/operators";

@Injectable({
    providedIn: 'root'
})
export class SvgAssetsService {
    private readonly WIDGET_PATH = 'assets/widgets';
    private readonly PREVIEW_PATH = 'assets/preview';
    
    // Cache pour stocker les SVG déjà téléchargés
    private svgCache: { [key: string]: Observable<string> } = {};

    constructor(private http: HttpClient) { }

    private loadSvg(path: string): Observable<string> {
        // Vérifier si le SVG est déjà en cache
        if (this.svgCache[path]) {
            return this.svgCache[path];
        }

        // Si non, télécharger et mettre en cache
        const svg$ = this.http.get(path, { responseType: 'text' }).pipe(
            map((response: string) => {
                // Extraire uniquement le contenu à l'intérieur des balises svg
                const matches = response.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
                if (matches && matches[1]) {
                    // Retourner uniquement le contenu intérieur du SVG
                    return matches[1].trim();
                }
                // Si pas de correspondance, retourner la chaîne vide
                return '';
            }),
            // Gérer les erreurs de chargement
            catchError(() => of('')),
            // Partager le résultat entre plusieurs abonnés et le mettre en cache
            shareReplay(1)
        );

        // Stocker dans le cache
        this.svgCache[path] = svg$;
        
        return svg$;
    }


    getBeardPath(shape: BeardShape, isPreview: boolean = false): Observable<string> {
        const basePath = isPreview ? this.PREVIEW_PATH : this.WIDGET_PATH;
        switch (shape) {
            case BeardShape.Scruff:
                return this.loadSvg(`${basePath}/beard/scruff.svg`);
            default:
                return of('');
        }
    }

    getFacePath(shape: FaceShape, isPreview: boolean = false): Observable<string> {
        const basePath = isPreview ? this.PREVIEW_PATH : this.WIDGET_PATH;
        switch (shape) {
            case FaceShape.Base:
                return this.loadSvg(`${basePath}/face/base.svg`);
            default:
                return of('M69 49c0-37 31-67 69-67s69 30 69 67c0 37-31 67-69 67s-69-30-69-67z');
        }
    }


    getClothesPath(shape: ClothesShape, isPreview: boolean = false): Observable<string> {
        const basePath = isPreview ? this.PREVIEW_PATH : this.WIDGET_PATH;
        switch (shape) {
            case ClothesShape.Crew:
                return this.loadSvg(`${basePath}/clothes/crew.svg`);
            case ClothesShape.Open:
                return this.loadSvg(`${basePath}/clothes/open.svg`);
            case ClothesShape.Collared:
                return this.loadSvg(`${basePath}/clothes/collared.svg`);
            default:
                return of('');
        }
    }

    getEarringsPath(shape: EarringsShape, isPreview: boolean = false): Observable<string> {
        const basePath = isPreview ? this.PREVIEW_PATH : this.WIDGET_PATH;
        switch (shape) {
            case EarringsShape.Stud:
                return this.loadSvg(`${basePath}/earrings/stud.svg`);
            case EarringsShape.Hoop:
                return this.loadSvg(`${basePath}/earrings/hoop.svg`);
            default:
                return of('');
        }
    }

    getEarPath(shape: EarShape, isPreview: boolean = false): Observable<string> {
        const basePath = isPreview ? this.PREVIEW_PATH : this.WIDGET_PATH;

        switch (shape) {
            case EarShape.Attached:
                return this.loadSvg(`${basePath}/ear/attached.svg`);
            case EarShape.Detached:
                return this.loadSvg(`${basePath}/ear/detached.svg`);
            default:
                return of('');
        }
    }

    getEyebrowsPath(shape: EyebrowsShape, isPreview: boolean = false): Observable<string> {
        const basePath = isPreview ? this.PREVIEW_PATH : this.WIDGET_PATH;
        switch (shape) {
            case EyebrowsShape.Up:
                return this.loadSvg(`${basePath}/eyebrows/up.svg`);
            case EyebrowsShape.Down:
                return this.loadSvg(`${basePath}/eyebrows/down.svg`);
            case EyebrowsShape.Eyelashesup:
                return this.loadSvg(`${basePath}/eyebrows/eyelashesup.svg`);
            case EyebrowsShape.Eyelashesdown:
                return this.loadSvg(`${basePath}/eyebrows/eyelashesdown.svg`);
            default:
                return of('');
        }
    }

    getEyesPath(shape: EyesShape, isPreview: boolean = false): Observable<string> {
        const basePath = isPreview ? this.PREVIEW_PATH : this.WIDGET_PATH;
        switch (shape) {
            case EyesShape.Round:
                return this.loadSvg(`${basePath}/eyes/round.svg`);
            case EyesShape.Ellipse:
                return this.loadSvg(`${basePath}/eyes/ellipse.svg`);
            case EyesShape.Smiling:
                return this.loadSvg(`${basePath}/eyes/smiling.svg`);
            case EyesShape.Eyeshadow:
                return this.loadSvg(`${basePath}/eyes/eyeshadow.svg`);
            default:
                return of('');
        }
    }

    getMouthPath(shape: MouthShape, isPreview: boolean = false): Observable<string> {
        const basePath = isPreview ? this.PREVIEW_PATH : this.WIDGET_PATH;
        switch (shape) {
            case MouthShape.Smile:
                return this.loadSvg(`${basePath}/mouth/smile.svg`);
            case MouthShape.Laughing:
                return this.loadSvg(`${basePath}/mouth/laughing.svg`);
            case MouthShape.Surprised:
                return this.loadSvg(`${basePath}/mouth/surprised.svg`);
            case MouthShape.Sad:
                return this.loadSvg(`${basePath}/mouth/sad.svg`);
            case MouthShape.Pucker:
                return this.loadSvg(`${basePath}/mouth/pucker.svg`);
            case MouthShape.Frown:
                return this.loadSvg(`${basePath}/mouth/frown.svg`);
            case MouthShape.Smirk:
                return this.loadSvg(`${basePath}/mouth/smirk.svg`);
            case MouthShape.Nervous:
                return this.loadSvg(`${basePath}/mouth/nervous.svg`);
            default:
                return of('');
        }
    }

    getNosePath(shape: NoseShape, isPreview: boolean = false): Observable<string> {
        const basePath = isPreview ? this.PREVIEW_PATH : this.WIDGET_PATH;
        switch (shape) {
            case NoseShape.Round:
                return this.loadSvg(`${basePath}/nose/round.svg`);
            case NoseShape.Pointed:
                return this.loadSvg(`${basePath}/nose/pointed.svg`);
            case NoseShape.Curve:
                return this.loadSvg(`${basePath}/nose/curve.svg`);
            default:
                return of('');
        }
    }

    getGlassesPath(shape: GlassesShape, isPreview: boolean = false): Observable<string> {
        const basePath = isPreview ? this.PREVIEW_PATH : this.WIDGET_PATH;
        switch (shape) {
            case GlassesShape.Round:
                return this.loadSvg(`${basePath}/glasses/round.svg`);
            case GlassesShape.Square:
                return this.loadSvg(`${basePath}/glasses/square.svg`);
            default:
                return of('');
        }
    }

    getTopsPath(shape: TopsShape, isPreview: boolean = false): Observable<string> {
        const basePath = isPreview ? this.PREVIEW_PATH : this.WIDGET_PATH;
        switch (shape) {
            case TopsShape.Clean:
                return this.loadSvg(`${basePath}/tops/clean.svg`);
            case TopsShape.Wave:
                return this.loadSvg(`${basePath}/tops/wave.svg`);
            case TopsShape.Pixie:
                return this.loadSvg(`${basePath}/tops/pixie.svg`);
            case TopsShape.Danny:
                return this.loadSvg(`${basePath}/tops/danny.svg`);
            case TopsShape.Fonze:
                return this.loadSvg(`${basePath}/tops/fonze.svg`);
            case TopsShape.Funny:
                return this.loadSvg(`${basePath}/tops/funny.svg`);
            case TopsShape.Punk:
                return this.loadSvg(`${basePath}/tops/punk.svg`);
            case TopsShape.Beanie:
                return this.loadSvg(`${basePath}/tops/beanie.svg`);
            case TopsShape.Turban:
                return this.loadSvg(`${basePath}/tops/turban.svg`);
            default:
                return of('');
        }
    }

    // Méthodes pour les prévisualisations
    getTopsPreviewPath(shape: TopsShape): Observable<string> {
        return this.getTopsPath(shape, true);
    }

    getEyesPreviewPath(shape: EyesShape): Observable<string> {
        return this.getEyesPath(shape, true);
    }

    getEyebrowsPreviewPath(shape: EyebrowsShape): Observable<string> {
        return this.getEyebrowsPath(shape, true);
    }

    getNosePreviewPath(shape: NoseShape): Observable<string> {
        return this.getNosePath(shape, true);
    }

    getMouthPreviewPath(shape: MouthShape): Observable<string> {
        return this.getMouthPath(shape, true);
    }

    getClothesPreviewPath(shape: ClothesShape): Observable<string> {
        return this.getClothesPath(shape, true);
    }

    getGlassesPreviewPath(shape: GlassesShape): Observable<string> {
        return this.getGlassesPath(shape, true);
    }

    getEarringsPreviewPath(shape: EarringsShape): Observable<string> {
        return this.getEarringsPath(shape, true);
    }

    getBeardPreviewPath(shape: BeardShape): Observable<string> {
        return this.getBeardPath(shape, true);
    }

    // Méthode pour vider le cache si nécessaire
    clearCache(): void {
        this.svgCache = {};
    }
}
