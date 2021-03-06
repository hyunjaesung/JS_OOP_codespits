const type = (target, type) => {
  if (typeof type == "string") {
    if (typeof target != type) throw `invalidType ${target} : ${type}`;
  } else if (!(target instanceof type)) {
    throw `invalidType ${target} : ${type}`;
  }
  return target;
};

const err = (v) => {
  throw v;
};

const ViewModelListener = class {
  viewmodelUpdated(viewmodel, updated) {
    throw "override";
  }
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

const Binder = class extends ViewModelListener {
  #items = new Set();
  #processors = {};

  add(item, _ = type(item, BinderItem)) {
    // 스캐너가 이걸로 넣어줄거야
    this.#items.add(item);
  }

  addProcessor(p, _0 = type(p, Processor)) {
    // 계약
    this.#processors[p.category] = p;
  }

  render(viewmodel, _ = type(viewmodel, ViewModel)) {
    const processors = Object.entries(this.#processors);
    this.#items.forEach((item) => {
      const vm = type(viewmodel[item.viewmodel], ViewModel);
      const el = item.el;

      processors.forEach(([pKey, processor]) => {
        if (vm[pKey]) {
          Object.entries(vm[pKey]).forEach(([key, value]) => {
            processor.process(vm, el, key, value);
          });
        }
      });
    });
  }
  // 특정 뷰모델에 옵저버가 될건지 안될건지
  watch(viewmodel, _ = type(viewmodel, ViewModel)) {
    viewmodel.addListener(this);
    this.render(viewmodel);
  }
  unwatch(viewmodel, _ = type(viewmodel, ViewModel)) {
    viewmodel.removeListener(this);
  }

  viewmodelUpdated(target, updated, _ = type(target, ViewModel)) {
    const items = {};
    this.#items.forEach((item) => {
      items[item.viewmodel] = [
        type(target[item.viewmodel], ViewModel),
        item.el
      ];
    });
    updated.forEach(({ subKey, category, key, value }) => {
      if (!items[subKey]) return;
      const [vm, el] = items[subKey];
      const processor = this.#processors[category.split(".").pop()];

      // injection 이 안 되어 있을 경우  return
      if (!el || !processor) return;
      processor.process(vm, el, key, value);
    });
  }
};

// 추상 클래스
const Visitor = class {
  visit(action, target, _0 = type(action, "function")) {
    // target 인자는 상속받는 쪽에서 오버라이드 해서 결정
    // 타 언어에서는 제네릭으로 자식에서 타입 적용가능
    throw "override";
  }
};

const DomVisitor = class extends Visitor {
  constructor() {
    super();
  }
  visit(
    action,
    target,
    _0 = type(action, "function"),
    _1 = type(target, HTMLElement)
  ) {
    // DOM 순회 코드 패턴
    const stack = [];
    let curr = target.firstElementChild;
    do {
      action(curr);
      if (curr.firstElementChild) stack.push(curr.firstElementChild);
      if (curr.nextElementSibling) stack.push(curr.nextElementSibling);
    } while ((curr = stack.pop()));
  }
};

// Scanner의 추상 클래스
const Scanner = class {
  #visitor; // 같은 계층의 visitor
  // 같은 수준 맞추기 위해 네이티브 지식이 없어야한다
  constructor(visitor, _ = type(visitor, DomVisitor)) {
    this.#visitor = visitor;
  }
  // 자식이 부모에 접근하기 위해서 한번더 감싼 visit 메서드 만들어서 위임
  visit(action, target) {
    this.#visitor.visit(action, target);
  }

  // override 하기위한 함수
  // 지저분한 로직은 안쓰고 계층을 맞춘다
  scan(target) {
    throw "override";
  }
};

const DomScanner = class extends Scanner {
  constructor(visitor, _ = type(visitor, DomVisitor)) {
    super(visitor); // 자식이 부모를 대체
  }

  scan(target, _ = type(target, HTMLElement)) {
    const binder = new Binder();
    const action = (el) => {
      const vm = el.getAttribute("data-viewmodel");
      if (vm) binder.add(new BinderItem(el, vm));
    };
    action(target);
    this.visit(action, target); // 이제 계층 일치
    return binder;
  }
};

// Binder의 Strategy가 될 Class
const Processor = class {
  category;
  constructor(category) {
    this.category = category;
    Object.freeze(this);
  }

  // template method
  process(
    vm,
    el,
    key,
    value,
    _0 = type(vm, ViewModel),
    _1 = type(el, HTMLElement),
    _2 = type(key, "string")
  ) {
    this._process(vm, el, key, value);
  }

  // hook method
  _process(vm, el, k, v) {
    throw "override";
  }
};

// Info객체
const ViewModelValue = class {
  subKey;
  category;
  key;
  value;
  constructor(subKey, category, key, value) {
    this.subKey = subKey;
    this.category = category;
    this.key = key;
    this.value = value;
    Object.freeze(this);
  }
};

const ViewModelSubject = class extends ViewModelListener {
  #info = new Set();
  #listeners = new Set();

  add(value, _ = type(value, ViewModelValue)) {
    this.#info.add(value);
  }
  clear() {
    this.#info.clear();
  }

  addListener(listener, _ = type(listener, ViewModelListener)) {
    this.#listeners.add(listener);
    ViewModelSubject.watch(this);
  }
  removeListener(listener, _ = type(listener, ViewModelListener)) {
    this.#listeners.delete(listener);
    if (!this.#listeners.size) ViewModelSubject.unwatch(this);
  }
  notify() {
    this.#listeners.forEach((listener) =>
      listener.viewmodelUpdated(this.notifyTarget, this.#info)
    );
  }
  get notifyTarget() {
    throw "must be override!";
  } // ViewModel에게 위임한다.

  static #subjects = new Set();
  static #inited = false;
  static notify() {
    const f = () => {
      this.#subjects.forEach((vm) => {
        if (vm.#info.size) {
          vm.notify();
          vm.clear();
        }
      });
      if (this.#inited) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }

  // 리스너에 등록된 뷰모델이 있어야 시작
  static watch(vm, _ = type(vm, ViewModelListener)) {
    this.#subjects.add(vm);
    if (!this.#inited) {
      this.#inited = true; // 감시 시작
      this.notify();
    }
  }

  static unwatch(vm, _ = type(vm, ViewModelListener)) {
    this.#subjects.delete(vm);
    if (!this.#subjects.size) this.#inited = false; // 감시 끄기
  }
};

const ViewModel = class extends ViewModelSubject {
  static get(data) {
    return new ViewModel(data);
  }

  // 고정하던 부분 삭제
  // styles = {};
  // attributes = {};
  // properties = {};
  // events = {};

  // public getter private setter 패턴
  // 외부에서는 읽기전용만 가능 readonly
  #subKey = "";
  get subKey() {
    return this.#subKey;
  }

  #parent = null;
  get parent() {
    return this.#parent;
  }
  _setParent(parent, subKey) {
    this.#parent = type(parent, ViewModel);

    this.#subKey = subKey;
    this.addListener(parent);
  }

  // static descriptor = (vm, category, k, v) => ({
  //   enumerable: true,
  //   get: () => v,
  //   set: (newV) => {
  //     v = newV;
  //     vm.add(new ViewModelValue(vm.subKey, category, k, v));
  //   }
  // });

  // static defineProperties = (vm, category, obj) =>
  //   Object.defineProperties(
  //     obj,
  //     Object.entries(obj).reduce(
  //       (r, [k, v]) => ((r[k] = ViewModel.descriptor(vm, category, k, v)), r),
  //       {}
  //     )
  //   );

  static KEY = Symbol();
  // 모든 Key를 Observer에게 보고한다.
  define(target, k, v) {
    if (v && typeof v == "object" && !(v instanceof ViewModel)) {
      if (v instanceof Array) {
        // 배열이 value 인경우
        target[k] = [];

        target[k][ViewModel.KEY] = target[ViewModel.KEY] + "." + k;
        // 상대적인 경로 표기. key의 확장

        v.forEach((v, i) => this.define(target[k], i, v)); // 재귀로 안으로 들어간다
      } else {
        // Object가 value 인 경우
        target[k] = { [ViewModel.KEY]: target[ViewModel.KEY] + "." + k };
        Object.entries(v).forEach(([ik, iv]) => this.define(target[k], ik, iv));
      }
      Object.defineProperty(target[k], "subKey", {
        get: () => target.subKey
      });
    } else {
      // 재귀 함수는 재귀가 끝나는 조건을 명확하게 알면 된다.
      // 종결 조건을 반드시 만들어야 한다.
      if (v instanceof ViewModel) v._setParent(this, k);

      // 이리 짜면 크롬 빼곤 배열 length 안나올수도..
      Object.defineProperties(target, {
        [k]: {
          enumerable: true,
          get: (_) => v,
          set: (newV) => {
            v = newV;

            // 완성된 KEY가 들어가는 곳
            // category가 된다
            this.add(
              new ViewModelValue(target.subKey, target[ViewModel.KEY], k, v)
            );
          }
        }
      });
    }
  }

  constructor(data, _ = type(data, "object")) {
    super();
    this[ViewModel.KEY] = "root";

    // Object.entries(data).forEach([key, value] => this[key] = value);
    // 단순히 위처럼 넣지 않고 defineProperty를 쓰기 위해서 this category value 다 보내줘야한다
    // define이 value 따라서 parser의 기능 수행 할 것
    // 재귀 함수는 진입점 함수와 루프함수가 있다
    // 여기 쓰이는건 진입점 함수가 된다
    Object.entries(data).forEach(([k, v]) => {
      this.define(this, k, v);
    });

    // Object.entries(data).forEach(([key, value]) => {
    //   if ("styles,attributes,properties".includes(key)) {
    //     this[key] = ViewModel.defineProperties(this, key, value);
    //   } else {
    //     Object.defineProperty(
    //       this,
    //       key,
    //       ViewModel.descriptor(this, "", key, value)
    //     );
    //     if (value instanceof ViewModel) {
    //       value.setParent(this, key);
    //     }
    //   }
    // });
    Object.seal(this);
  }

  viewmodelUpdated(viewmodel, update) {
    update.forEach((value) => this.add(value));
  }

  get notifyTarget() {
    return this;
  }
};

// 실행
const scanner = new DomScanner(new DomVisitor());
// const binder = scanner.scan(document.querySelector("#target"));
// binder.addProcessor(
//   new (class extends Processor {
//     _process(vm, el, k, v) {
//       el.style[k] = v;
//     }
//   })("styles")
// );
// binder.addProcessor(
//   new (class extends Processor {
//     _process(vm, el, k, v) {
//       el.setAttribute(k, v);
//     }
//   })("attributes")
// );
// binder.addProcessor(
//   new (class extends Processor {
//     _process(vm, el, k, v) {
//       el[k] = v;
//     }
//   })("properties")
// );
// binder.addProcessor(
//   new (class extends Processor {
//     _process(vm, el, k, v) {
//       el[`on${k}`] = (e) => v.call(el, e, vm);
//     }
//   })("events")
// );

const setDomProcessor = ((_) => {
  const visitor = new DomVisitor();
  const scanner = new DomScanner(visitor);
  const baseProcessors = [
    new (class extends Processor {
      _process(vm, el, k, v) {
        el.style[k] = v;
      }
    })("styles"),
    new (class extends Processor {
      _process(vm, el, k, v) {
        el.setAttribute(k, v);
      }
    })("attributes"),
    new (class extends Processor {
      _process(vm, el, k, v) {
        el[k] = v;
      }
    })("properties"),
    new (class extends Processor {
      _process(vm, el, k, v) {
        el["on" + k] = (e) => v.call(el, e, vm);
      }
    })("events"),
    new (class extends Processor {
      _process(vm, el, k, v) {
        const { name = err("no name"), data = err("no data") } = vm.template;
        const template = DomScanner.get(name) || err("no template:" + name);
        if (!(data instanceof Array)) err("invaild data:" + data);
        Object.freeze(data);
        visitor.visit((el) => {
          if (el.binder) {
            const [binder, vm] = el.binder;
            binder.unwatch(vm);
            delete el.binder;
          }
        }, el);
        el.innerHTML = "";
        data.forEach((vm, i) => {
          if (!(vm instanceof ViewModel)) err(`invalid Viewmodel:${i} - ${vm}`);
          const child = template.cloneNode(true);
          const binder = setProcessor(scanner.scan(child));
          el.binders = [binder, vm];
          binder.watch(vm);
          el.appendChild(child);
        });
      }
    })("template")
  ];
  const setProcessor = (binder, _ = type(binder, Binder)) => {
    baseProcessors.forEach((v) => binder.addProcessor(v));
    return binder;
  };
  return setProcessor;
})();

const getRandom = () => parseInt(Math.random() * 150) + 100;
const wrapper = ViewModel.get({
  styles: { width: "50%", background: "#ffa", cursor: "pointer" },
  events: {
    click(e, vm) {
      vm.parent.isStop = true;
    }
  }
});
const title = ViewModel.get({ properties: { innerHTML: "Title" } });
const contents = ViewModel.get({ properties: { innerHTML: "Contents" } });
const rootViewModel = ViewModel.get({
  isStop: false,
  changeContents() {
    this.wrapper.styles.background = `rgb(${getRandom()},${getRandom()},${getRandom()})`;
    this.contents.properties.innerHTML = Math.random()
      .toString(16)
      .replace(".", "");
  },
  wrapper,
  title,
  contents
});

const binder = setDomProcessor(scanner.scan(document.body));
binder.watch(rootViewModel);
const f = () => {
  rootViewModel.changeContents();
  // if (!rootViewModel.isStop) setTimeout(f, 5000)
};
setTimeout(f, 5000);
