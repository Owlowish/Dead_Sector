/** Présentation de l'accueil, de la pause et de leurs panneaux communs. */
export class GameMenus {
  private readonly title = document.querySelector<HTMLElement>('#title-screen');
  private readonly pause = document.querySelector<HTMLElement>('#pause-message');
  private readonly dialog = document.querySelector<HTMLDialogElement>('#menu-dialog');
  private readonly enter = document.querySelector<HTMLButtonElement>('#title-play');
  private readonly resume = document.querySelector<HTMLButtonElement>('#pause-resume');
  private readonly events = new AbortController();

  constructor(requestControl: () => void, enableAudio: () => void) {
    const { signal } = this.events;
    this.enter?.addEventListener('click', requestControl, { signal });
    this.resume?.addEventListener('click', requestControl, { signal });
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-menu-open]')) {
      button.addEventListener('click', () => {
        enableAudio();
        this.openPanel(button.dataset.menuOpen);
      }, { signal });
    }
  }

  public get panelOpen(): boolean {
    return this.dialog?.open ?? false;
  }

  private openPanel(panel: string | undefined): void {
    if (!this.dialog || this.dialog.open) return;
    for (const section of this.dialog.querySelectorAll<HTMLElement>('section')) {
      section.hidden = section.id !== `menu-${panel}`;
    }
    this.dialog.setAttribute('aria-labelledby', `menu-${panel}-title`);
    this.dialog.showModal();
  }

  public setTitle(visible: boolean): void {
    if (this.title) this.title.hidden = !visible;
    if (visible) this.enter?.focus();
  }

  public focusResume(): void {
    this.resume?.focus();
  }

  public setCaptureError(failed: boolean): void {
    const message = failed ? 'La souris n’a pas pu être capturée. Cliquez pour réessayer.' : '';
    for (const overlay of [this.title, this.pause]) {
      const status = overlay?.querySelector<HTMLElement>('.menu-lock-error');
      if (status) status.textContent = message;
    }
  }

  public closePanel(): void {
    if (this.dialog?.open) this.dialog.close();
  }

  public dispose(): void {
    this.events.abort();
    this.closePanel();
    this.setTitle(false);
  }
}
