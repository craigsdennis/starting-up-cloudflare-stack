document.addEventListener("DOMContentLoaded", () => {
	fetchCards();
  });

  /**
   * Fetch the list of cards from /api/cards and render them.
   */
  async function fetchCards() {
	try {
	  const response = await fetch("/api/cards");
	  if (!response.ok) {
		throw new Error("Network response was not ok.");
	  }
	  const cards = await response.json();

	  const container = document.getElementById("cards-container");

	  // For each card, create a flip-card element and append it to the container
	  for (const card of cards) {
		const flipCardElement = await createFlipCard(card);
		container.appendChild(flipCardElement);
	  }
	} catch (error) {
	  console.error("Error fetching cards:", error);
	}
  }

  /**
   * Creates a single flip-card DOM element for a given card.
   * - Front: Product title + optional SVG
   * - Back: Description + "Read More" link
   */
  async function createFlipCard(card) {
	// Attempt to fetch SVG content for the card
	let svgContent = "";
	try {
	  const svgRes = await fetch(`/api/cards/${card.slug}/svg`);
	  if (!svgRes.ok) {
		throw new Error("SVG fetch was not ok.");
	  }
	  const svgData = await svgRes.json();
	  // The returned JSON has a "result" key with the raw SVG as HTML string
	  svgContent = svgData.result;
	} catch (svgError) {
	  console.warn(`Error fetching SVG for slug "${card.slug}":`, svgError);
	}

	// Create the flip-card container
	const flipCard = document.createElement("div");
	flipCard.classList.add("flip-card");

	// Create inner wrapper
	const flipCardInner = document.createElement("div");
	flipCardInner.classList.add("flip-card-inner");

	// FRONT side
	const flipCardFront = document.createElement("div");
	flipCardFront.classList.add("flip-card-front");

	// Create an element for the title
	const titleElem = document.createElement("h2");
	titleElem.classList.add("card-title");
	titleElem.textContent = card.title || "Untitled Product";
	flipCardFront.appendChild(titleElem);

	// If SVG content was fetched, insert it
	if (svgContent) {
	  const svgWrapper = document.createElement("div");
	  svgWrapper.classList.add("card-svg");
	  svgWrapper.innerHTML = svgContent;
	  flipCardFront.appendChild(svgWrapper);
	}

	// BACK side
	const flipCardBack = document.createElement("div");
	flipCardBack.classList.add("flip-card-back");

	// Description
	const descriptionDiv = document.createElement("div");
	descriptionDiv.classList.add("card-description");
	descriptionDiv.textContent = card.description || "No description provided.";
	flipCardBack.appendChild(descriptionDiv);

	// "Read More" link
	const readMoreLink = document.createElement("a");
	readMoreLink.classList.add("read-more-link");
	readMoreLink.href = card.url || "#";
	readMoreLink.textContent = "Read More";
	readMoreLink.target = "_blank";
	readMoreLink.rel = "noopener noreferrer";
	flipCardBack.appendChild(readMoreLink);

	// Assemble the structure
	flipCardInner.appendChild(flipCardFront);
	flipCardInner.appendChild(flipCardBack);
	flipCard.appendChild(flipCardInner);

	// Click event to flip the card
	flipCard.addEventListener("click", () => {
	  flipCard.classList.toggle("flip");
	});

	return flipCard;
  }
