import partyBoard from '../../../../../content/common/lobby/assembly-board.webp';
import partyBoardPreview from '../../../../../content/common/lobby/assembly-board-preview.webp?inline';

export { partyBoard, partyBoardPreview };

let boardImage: HTMLImageElement | null = null;
let boardPromise: Promise<void> | null = null;
let boardReady = false;

export function isPartyBoardReady(): boolean { return boardReady; }

export function loadPartyBoard(priority: 'low' | 'high' = 'low'): Promise<void> {
  if (boardImage && priority === 'high') boardImage.fetchPriority = priority;
  if (boardPromise) return boardPromise;
  const image = new Image();
  boardImage = image;
  image.fetchPriority = priority;
  image.decoding = 'async';
  const promise = new Promise<void>((resolve, reject) => {
    let finished = false;
    function finish(error?: Error) {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (error) { reject(error); return; }
      boardReady = true;
      resolve();
    }
    const timer = window.setTimeout(() => {
      const error = new Error('背景图片加载超时');
      finish(error);
    }, 15000);
    image.onload = () => {
      const decoded = image.decode();
      void decoded.then(() => finish()).catch(() => {
        const error = new Error('背景图片解码失败');
        finish(error);
      });
    };
    image.onerror = () => {
      const error = new Error('背景图片加载失败');
      finish(error);
    };
    image.src = partyBoard;
  });
  boardPromise = promise.catch(error => {
    boardPromise = null;
    boardImage = null;
    throw error;
  });
  return boardPromise;
}
