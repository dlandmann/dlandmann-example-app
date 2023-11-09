import type {
  RunInput,
  FunctionRunResult,
} from "../generated/api";
const NO_CHANGES: FunctionRunResult = {
  operations: [],
};

type Configuration = {
  factors?: Record<string, Record<string, number>>
};

const defaultFactors = {
  "Tops": {
    "T-Shirts": 0.3,
    "Longsleeves": 0.5,
    "Tanks": 0.2,
    "Polos": 0.3,
    "Girlies": 0.25,
    "Kids": 0.3,
    "Sleeveless": 0.3,
    "Shirts": 1.1,
    "Hoodies": 1.1
  },
  "Patch": {
    "Backpatch": 0.2
  },
  "Underwear": {
    "Boxershorts": 0.2,
    "Panties": 0.3
  },
  "Shorts": {
    "Mesh Shorts": 0.3,
    "Sport Shorts": 0.5,
    "Sweatshorts": 0.3,
    "Hotpants": 0.5
  },
  "Leggings": {
    "Leggings": 0.5,
    "Tights": 0.5
  },
  "Pants": {
    "Shorts": 0.5
  },
  "Medium": {
    "CD": 0.25
  },
  "Jewelry": {
    "Necklaces": 0.2,
    "Earrings": 0.25,
    "Rings": 0.3,
    "Tunnels": 0.1,
    "Earplugs": 0.2,
    "Face Jewels": 0.1,
    "Piercings": 0.1
  },
  "Living": {
    "Flags": 0.35,
    "Notebooks": 0.7,
    "Plectra": 0.05,
    "Mousepads": 0.2,
    "Slipmats": 0.2,
    "Air Refreshener": 0.05
  },
  "Cosmetics": {
    "Condoms": 0.1
  },
  "Beanies": {
    "Long Beanie": 0.2,
    "Beanie": 0.3,
    "Pom Beanie": 0.7
  },
  "Swimwear": {
    "Board Shorts": 0.5,
    "Bikinis": 0.5,
    "Swimsuit": 0.5,
    "Bikini Top": 0.3,
    "Bikini Bottom": 0.3
  },
  "Bags": {
    "Tote Bags": 0.25,
    "Messenger Bags": 0.55
  },
  "Backpacks": {
    "Drawstring Backpacks": 0.25
  },
  "Accessories": {
    "Patches": 0.05,
    "Socks": 0.33,
    "Pins": 0.1,
    "Keychains": 0.3,
    "Wallets": 0.5,
    "Buttons": 0.1,
    "Gloves": 0.3,
    "Bandanas": 0.2,
    "Wristbands": 0.2,
    "Lanyards": 0.2,
    "Masks": 0.2,
    "Scarfs": 0.5
  },
  "Food and Beverages": {
    "Bubble Gum": 0.25
  },
  "department": {
    "Tickets": 0.2
  }
} as const


const determineLineFactor = (cartLine: RunInput['cart']['lines'][0], factors) => {
  if (cartLine.merchandise.__typename !== 'ProductVariant') {
    return cartLine.quantity
  }

  const type = cartLine.merchandise.product.type?.value

  if (!type) {
    return cartLine.quantity
  }

  const typeObj = JSON.parse(type) as Record<string, string> | undefined | null
  if (!typeObj) {
    return cartLine.quantity
  }

  const lineFactorKey = Object.entries(typeObj).reverse().find(([key, value]) => {
    return factors[key]?.[value] != null
  })

  const lineFactor: number = lineFactorKey ? factors[lineFactorKey[0]][lineFactorKey[1]] : 1

  return lineFactor * cartLine.quantity
}


export function run(input: RunInput): FunctionRunResult {
  const configuration: Configuration = JSON.parse(
    input?.deliveryCustomization?.metafield?.value ?? "{}"
  );

  const factors = configuration.factors ?? defaultFactors

  const deliveryOptions = input.cart.deliveryGroups.map(g => g.deliveryOptions).flat()
  const uniqueDeliveryOptions = deliveryOptions.filter((deliveryOption, index, self) => {
    return self.findIndex(t => t.handle === deliveryOption.handle) === index
  })

  // check if warenpost exists
  const warenpostExists = uniqueDeliveryOptions.some(deliveryOption => {
    return deliveryOption.title === 'Warenpost'
  })
  if (!warenpostExists) {
    return NO_CHANGES
  }

  const cartFactor = input.cart.lines.reduce((acc, line) => {
    return acc + determineLineFactor(line, factors)
  }, 0)

  const warenpostHandle = uniqueDeliveryOptions.find(d => d.title === 'Warenpost')!.handle
  const notWarepostHandle = uniqueDeliveryOptions.find(d => d.title !== 'Warenpost')!.handle

  // either > 1 -> normal shipping
  if (cartFactor >= 1) {
    return {
      operations: [
        {
          hide: {
            deliveryOptionHandle: warenpostHandle
          }
        }
      ]
    }
  } else {
    // or < 1 -> Warenpost
    return {
      operations: [
        {
          hide: {
            deliveryOptionHandle: notWarepostHandle
          }
        },
        {
          rename: {
            deliveryOptionHandle: warenpostHandle,
            title: 'DHL'
          }
        }
      ]
    }
  }

};