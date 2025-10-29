export class ViewTransition {
  static async start() {
    if (!document.startViewTransition) {
      return Promise.resolve();
    }

    return document.startViewTransition(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  }

  static async fadeIn(element) {
    if (!document.startViewTransition) {
      element.style.opacity = "1";
      return;
    }

    const transition = document.startViewTransition(() => {
      element.style.opacity = "1";
    });

    await transition.ready;
    element.animate(
      [
        { opacity: 0, transform: "translateY(20px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      {
        duration: 300,
        easing: "ease-in-out",
      }
    );
  }
}
