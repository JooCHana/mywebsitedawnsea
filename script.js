"use strict";
document.documentElement.classList.add("js");
const menuButton = document.querySelector(".menu-toggle");
const navList = document.querySelector("#nav-links");
const navLinks = [...navList.querySelectorAll('a[href^="#"]')];
const sections = navLinks.map(link => document.querySelector(link.getAttribute("href")));
const header = document.querySelector(".site-header");
const mobileQuery = window.matchMedia("(max-width: 600px)");
// 更新版权年份。
document.querySelector("#year").textContent = new Date().getFullYear();
// 移动端菜单。
function setMenuOpen(open) {
  navList.classList.toggle("is-open", open);
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.textContent = open ? "收起" : "菜单";
}
menuButton.addEventListener("click", () => {
  setMenuOpen(menuButton.getAttribute("aria-expanded") !== "true");
});
navLinks.forEach(link => {
  link.addEventListener("click", () => {
    const target = document.querySelector(link.getAttribute("href"));
    setMenuOpen(false);
    if (target) {
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
      target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
    }
  });
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
    setMenuOpen(false);
    menuButton.focus();
  }
});
document.addEventListener("click", event => {
  if (!event.target.closest(".navigation")) setMenuOpen(false);
});
mobileQuery.addEventListener("change", () => {
  setMenuOpen(false);
  updateActiveNavigation();
});
// 随滚动位置高亮导航。
function updateActiveNavigation() {
 if (!sections.length) return;
  const offset = header.getBoundingClientRect().height + 40;
  let activeSection = sections[0];
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= offset) activeSection = section;
  }
  const pageIsScrollable = document.documentElement.scrollHeight > window.innerHeight + 2;
  const reachedBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
  if (pageIsScrollable && reachedBottom) activeSection = sections[sections.length - 1];
  navLinks.forEach(link => {
    if (link.getAttribute("href") === `#${activeSection.id}`) {
      link.setAttribute("aria-current", "location");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}
let updatePending = false;
function scheduleNavigationUpdate() {
  if (updatePending) return;
  updatePending = true;
  window.requestAnimationFrame(() => {
    updateActiveNavigation();
    updatePending = false;
  });
}
window.addEventListener("scroll", scheduleNavigationUpdate, { passive: true });
window.addEventListener("resize", scheduleNavigationUpdate);
updateActiveNavigation();
// 占位社交链接提示；填入真实 URL 后正常跳转。
const contactStatus = document.querySelector("#contact-status");
document.querySelectorAll(".social-link").forEach(link => {
  link.addEventListener("click", event => {
    if (link.getAttribute("href") !== "#") return;
    event.preventDefault();
    contactStatus.textContent = `${link.getAttribute("title")}链接暂未配置，敬请期待。`;
  });
});
