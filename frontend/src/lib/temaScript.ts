/* Script que corre antes de pintar para evitar el parpadeo del tema. */
export const SCRIPT_TEMA = `try{if(localStorage.getItem("tema")==="claro")document.documentElement.dataset.tema="claro"}catch(e){}`;
