enum ASSET_TYPE {
  AUDIO,
  IMAGE,
}
interface State {
  interface?: boolean;
  setting?: boolean;
  gameover?: boolean;
  wordStep: number;
  chapter: number;
  scene: number;
  prompt: number;
  sentence: number;
  wording: boolean;
  line: number;
}
interface Choice {
  question: Sentence;
  answer: string[];
}
interface Charactor {
  name: string;
  images: {
    [Key: string]: string;
  };
}
interface Sentence {
  word: string;
  wait?: number;
  wordStep?: number;
  audio?: string;
}
// type Prompt = (Sentence[] | Charactor | Choice)[];
// interface Prompt {
//   charactor: Charactor;
//   sentence: (Sentence | Choice)[];
// }
interface Prompt {
  charactor: Charactor;
  sentence: Sentence[];
  choice?: Choice;
}
// interface Prompt {
//   sentence: Sentence[];
//   charactor: Charactor;
//   choice?: Choice;
// }
interface Background {
  image?: string;
  position?: string;
  color?: string;
}
interface Scene {
  prompt: Prompt[];
  id?: string;
  save?: boolean;
  background: Background;
}
interface Assets {
  type: ASSET_TYPE;
  url: string;
  preLoading?: number;
}
interface Id<T> {
  [id: string]: T;
}
interface Chapter {
  scene: Scene[];
  assets: Assets[];
}
class Canvas {
  protected width = 0;
  protected height = 0;
  #canvas = document.getElementById("visual-novel") as HTMLCanvasElement;
  protected context = this.#canvas.getContext("2d");
  constructor() {
    this.resizing(800, 600);
  }

  protected requestAnimationFrame() {
    this.draw();
    // this.requestAnimationFrame();
    requestAnimationFrame(this.requestAnimationFrame.bind(this));
  }
  protected resizing(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.#canvas.width = this.width;
    this.#canvas.height = this.height;
  }
  draw() {
    this.context.clearRect(0, 0, this.width, this.height);
  }
}
// class Dom {
//   width = 0;
//   height = 0;
//   context = document.getElementById("visual-novel") as HTMLDivElement;
//   constructor() {
//     this.resizing(800, 600);
//     // this.context.strokeRect(50, 50, 50, 50);
//   }
//   protected resizing(width: number, height: number) {
//     this.width = width;
//     this.height = height;
//     this.context.setAttribute(
//       "style",
//       `width: ${this.width}px; height: ${this.height}px;`
//     );
//   }
// }
class Game extends Canvas {
  // class Game extends Dom {
  readonly wordStep = 1 / 5;
  protected chapter: Chapter[];
  protected assets: Id<Assets[]>;
  protected state: State;

  constructor(chapter: Chapter[]) {
    super();
    this.onLoad();
    this.chapter = chapter;
    this.assets = Array(this.chapter.length)
      .fill(null)
      .reduce((a, _, i) => {
        const v = this.chapter[i].assets.reduce(
          (a, v) => ({
            ...a,
            [v.url]: v,
          }),
          {}
        );
        return { ...a, ...v };
      }, {});
    addEventListener("keypress", this.addEventListener.bind(this));
    this.requestAnimationFrame();

    // this.assets = [{url}]
  }

  get isChapter() {
    return this.chapter.length;
  }
  get isScene() {
    return this.chapter[this.state.chapter].scene.length;
  }
  get isPrompt() {
    return this.chapter[this.state.chapter].scene[this.state.scene].prompt
      .length;
  }
  get isSentence() {
    return this.chapter[this.state.chapter].scene[this.state.scene].prompt[
      this.state.prompt
    ].sentence.length;
  }

  onSave() {}
  onLoad() {
    this.state = {
      chapter: 0,
      scene: 0,
      prompt: 0,
      sentence: 0,
      wordStep: 0,
      line: 0,
      wording: true,
    };
  }
  addEventListener(e: KeyboardEvent) {
    console.log(e.key);
    switch (e.key) {
      case "i":
        this.state.interface = !this.state.interface;
        break;
      case "Enter":
        if (this.state.wording) {
          this.state.line = 99;
          return (this.state.wordStep = 99);
        } else {
          this.state.wordStep = 0;
          this.state.line = 0;
          this.state.wording = true;
        }
        if (this.state.sentence < this.isSentence)
          return (this.state.sentence += 1);
        else this.state.sentence = 0;
        if (this.state.prompt < this.isPrompt) return (this.state.prompt += 1);
        else this.state.prompt = 0;
        if (this.state.scene < this.isScene) return (this.state.sentence += 1);
        else this.state.sentence = 0;
        if (this.state.chapter < this.isChapter)
          return (this.state.chapter += 1);

        // else this.state.sentence = 0;

        // this.state.interface = !this.state.interface;
        break;
    }
  }

  chapterLoading() {}

  render() {}

  drawInterface() {
    if (this.state?.interface) {
      this.context.fillStyle = "black";
      this.context.fillRect(0, 0, this.width, this.height);
    }
  }
  getByteLengthOfString(s: string, b = 0, i = 0, c = 0) {
    for (b = i = 0; (c = s.charCodeAt(i++)); b += c >> 11 ? 3 : c >> 7 ? 2 : 1);
    return b;
  }
  drawPrompt() {
    const width = 600;
    const height = 200;
    const word = this.chapter[this.state.chapter]?.scene[
      this.state.scene
    ]?.prompt[this.state.prompt]?.sentence[this.state.sentence]?.word
      .split(" ")
      .reduce((a, v) => {
        const x = a + v;
        const arr = x.split("\n");
        const length = this.getByteLengthOfString(arr[arr.length - 1]);
        return length > 30 ? a + "\n" + v : x;
      }, "")
      .split("\n");
    const wordStep =
      this.chapter[this.state.chapter].scene[this.state.scene].prompt[
        this.state.prompt
      ].sentence[this.state.sentence].wordStep || this.wordStep;
    this.context.fillStyle = "black";
    this.context.fillRect(0, this.height - height, this.width, height);
    this.context.font = "48px serif";
    this.context.fillStyle = "white";
    for (const _index in word) {
      const index = +_index;
      // const startIndex = this.state.wordStep[index - 1] || 0;
      const endIndex = this.state.line === index ? this.state.wordStep : 99;
      const line = word[index];
      // if (index > 2) break;
      this.context.fillText(
        line.substring(0, endIndex),
        (this.width - width) / 2,
        this.height - height + 100 + index * 50,
        width
      );
      if (line === line.substring(0, endIndex)) {
        if (word.length - 1 > this.state.line) {
          this.state.wordStep = 0;
          this.state.line += 1;
        } else {
          this.state.wording = false;
        }
      } else {
        this.state.wordStep += wordStep;
        break;
      }
      // } else {
      //   this.state.wordStep = [0];
      // }
    }
  }

  draw() {
    super.draw();
    // console.log("djlakwdaw", this);
    this.drawPrompt();
    this.drawInterface();
  }
}
const dd = new Game([
  {
    scene: [
      {
        prompt: [
          {
            charactor: {
              name: "matthew",
              images: {},
            },
            sentence: [
              // { word: "테스트세트스으 rkske 가나다 간다ㅏ... 아저앚마앚" },
              {
                word: "우후앚암 djkla jajwjlk jl jlawj lajwl jw lkj wlkj l aj dawkdjla wjlkjl jlj l",
                wordStep: 1 / 2,
              },
              {
                word: "우후앚암",
                wordStep: 1 / 2,
              },
            ],
          },
        ],
        background: {
          image: "assets/shutterstock_376532611.jpeg",
        },
      },
    ],
    assets: [
      {
        type: ASSET_TYPE.IMAGE,
        url: "assets/shutterstock_376532611.jpeg",
      },
    ],
  },
  {
    scene: [],
    assets: [
      {
        type: ASSET_TYPE.IMAGE,
        url: "assets/sunset-1373171__480.jpeg",
      },
    ],
  },
]);
