// 1차 버전
const ViewModel = class {
  static #private = Symbol();

  static get(data) {
    // static으로 ViewModel.get() 으로만 뷰모델 생성 가능
    return new ViewModel(this.#private, data);
  }

  styles = {};
  attribute = {};
  properties = {};
  events = {};

  constructor(checker, data) {
    if (checker != ViewModel.#private) throw "use ViewModel.get() !!";
    // 외부에서는 생성 불가능하도록
    Object.entries(data).forEach(([key, value]) => {
      switch (key) {
        case "styles":
          this.styles = value;
          break;
        case "attribute":
          this.attribute = value;
          break;
        case "properties":
          this.properties = value;
          break;
        case "events":
          this.events = value;
          break;
        default:
          this[key] = value;
      }
    });
    Object.seal(this); // this를 밀봉, key 추가 불가
  }
};

const type = (target, type) => {
  if (typeof type == "string") {
    if (typeof target != type) throw `invalidType ${target} : ${type}`;
  } else if (!(target instanceof type)) {
    throw `invalidType ${target} : ${type}`;
  }
  return target;
};

const BinderItem = class {
  el;
  viewmodel;
  constructor(
    el,
    viewmodel,
    _0 = type(el, HTMLElement),
    _1 = type(viewmodel, "string")
  ) {
    this.el = el;
    this.viewmodel = viewmodel;
    Object.freeze(this); // this 동결
    // seal과 차이점은 쓰기 가능한 속성값은 seal은 변경
  }
};

const Binder = class {
  #items = new Set();
  add(item, _ = type(item, BinderItem)) {
    // 스캐너가 이걸로 넣어줄거야
    this.#items.add(item);
  }

  render(viewmodel, _ = type(viewmodel, ViewModel)) {
    console.log(this.#items);
    this.#items.forEach((item) => {
      // binderItem 의 두가지 속성 찾기
      const vm = type(viewmodel[item.viewmodel], ViewModel);
      const el = item.el; // el 은 binderItem에서 체크 했다
      Object.entries(vm.styles).forEach(
        ([key, value]) => (el.style[key] = value)
      );
      Object.entries(vm.attribute).forEach(([key, value]) =>
        el.setAttribute(key, value)
      );
      console.log(vm.properties, el.innerHTML);
      Object.entries(vm.properties).forEach(([key, value]) => {
        el[key] = value;
      });
      console.log();
      Object.entries(vm.events).forEach(
        ([key, value]) => (el["on" + key] = (e) => value.call(el, e, viewmodel))
        // call 로 콜백 함수의 this를 바인딩 해서 확정
        // 인자로 네이티브 event와 viewmodel 두개 다 받아서 전달
      );
    });
  }
};

const Scanner = class {
  scan(el, _ = type(el, HTMLElement)) {
    const binder = new Binder(); // 바인더 만든다음에 넣어서 리턴
    this.checkItem(binder, el); // 조상 넣어주기
    // DOM 루프
    const stack = [el.firstElementChild];
    let target;
    while ((target = stack.pop())) {
      this.checkItem(binder, target); // 자식들도 검정해서 넣어주기
      if (target.firstElementChild) stack.push(target.firstElementChild);
      // 자식 안에 자식이 있는지 확인
      if (target.nextElementSibling) stack.push(target.nextElementSibling);
      // 자식의 형제가 있는지 확인
      // 스택 때문에 계속 형제의 형제 형제의 형제 가면서 쫘악 다 끌어온다
    }
    return binder;
  }

  checkItem(binder, el) {
    const vm = el.getAttribute("data-viewmodel");
    // html 스펙이 바뀌면 여기만 바꾸면 된다
    if (vm) binder.add(new BinderItem(el, vm));
  }
};

const viewmodel = ViewModel.get({
  potatoWrapper: ViewModel.get({
    styles: {
      width: "50%",
      background: "#ffa",
      cursor: "pointer"
    }
  }),
  potatoTitle: ViewModel.get({
    properties: {
      innerHTML: "Title"
    }
  }),
  potatoContents: ViewModel.get({
    properties: {
      innerHTML: "Contents"
    }
  })
});

const scanner = new Scanner();
const binder = scanner.scan(document.querySelector("#target"));
binder.render(viewmodel);
