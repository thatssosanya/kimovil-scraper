import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useReducer } from "react";
import { type ParsedUrlQuery } from "querystring";
import { useMemo } from "react";

export type DeviceUrlState = {
  search: string;
  activeFilters: string[];
  deviceType?: string;
  sort?: string;
  order?: "asc" | "desc";
};

type LocalState = Omit<DeviceUrlState, "search">;

type Action =
  | { type: "SET_ACTIVE_FILTERS"; payload: string[] }
  | { type: "SET_DEVICE_TYPE"; payload: string | undefined }
  | { type: "SET_SORT"; payload: string | undefined }
  | { type: "SET_ORDER"; payload: "asc" | "desc" | undefined };

function localStateReducer(state: LocalState, action: Action): LocalState {
  switch (action.type) {
    case "SET_ACTIVE_FILTERS":
      return { ...state, activeFilters: action.payload };
    case "SET_DEVICE_TYPE":
      return { ...state, deviceType: action.payload };
    case "SET_SORT":
      return { ...state, sort: action.payload };
    case "SET_ORDER":
      return { ...state, order: action.payload };
    default:
      return state;
  }
}

// Only keep search in URL, everything else in local state
function parseQuery(query: ParsedUrlQuery): Pick<DeviceUrlState, "search"> {
  const search = Array.isArray(query.search) ? query.search[0] : query.search;
  return { search: search || "" };
}

const DEBOUNCE_MS = 500;

export function useDeviceUrlState() {
  const router = useRouter();
  const [localState, dispatch] = useReducer(localStateReducer, {
    activeFilters: [],
    deviceType: undefined,
    sort: undefined,
    order: undefined,
  });

  // Debounce timer for search updates
  const searchDebounceTimer = useRef<NodeJS.Timeout>();
  const lastSearchRef = useRef<string>("");

  // Parse only search from URL and memoize based on the search value only
  const urlState = useMemo(() => {
    const parsed = parseQuery(router.query);
    if (parsed.search === lastSearchRef.current) {
      return { search: lastSearchRef.current };
    }
    lastSearchRef.current = parsed.search;
    return parsed;
  }, [router.query]);

  const updateSearch = useCallback(
    (searchValue: string) => {
      if (searchValue === lastSearchRef.current) return;

      if (searchDebounceTimer.current) {
        clearTimeout(searchDebounceTimer.current);
      }

      searchDebounceTimer.current = setTimeout(() => {
        const query = { ...router.query };
        if (searchValue) {
          query.search = searchValue;
        } else {
          delete query.search;
        }

        void router.replace({ pathname: router.pathname, query }, undefined, {
          shallow: true,
        });
      }, DEBOUNCE_MS);
    },
    [router]
  );

  const updateUrlState = useCallback(
    (updates: Partial<DeviceUrlState>) => {
      if ("search" in updates) {
        updateSearch(updates.search ?? "");
      }

      if ("activeFilters" in updates) {
        dispatch({
          type: "SET_ACTIVE_FILTERS",
          payload: updates.activeFilters ?? [],
        });
      }
      if ("deviceType" in updates) {
        dispatch({ type: "SET_DEVICE_TYPE", payload: updates.deviceType });
      }
      if ("sort" in updates) {
        dispatch({ type: "SET_SORT", payload: updates.sort });
      }
      if ("order" in updates) {
        dispatch({ type: "SET_ORDER", payload: updates.order });
      }
    },
    [updateSearch]
  );

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (searchDebounceTimer.current) {
        clearTimeout(searchDebounceTimer.current);
      }
    };
  }, []);

  return {
    search: urlState.search,
    ...localState,
    updateUrlState,
  };
}
