import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Mock leaflet — it requires browser APIs unavailable in jsdom
vi.mock('leaflet', () => {
	const tileLayer = { addTo: vi.fn() };
	const polyline = { addTo: vi.fn() };
	const marker = { addTo: vi.fn(), setLatLng: vi.fn(), bindPopup: vi.fn() };
	const mapInstance = {
		setView: vi.fn().mockReturnThis(),
		remove: vi.fn(),
		invalidateSize: vi.fn(),
		flyTo: vi.fn(),
		getZoom: vi.fn(() => 4),
	};
	const exports = {
		map: vi.fn(() => mapInstance),
		tileLayer: vi.fn(() => tileLayer),
		marker: vi.fn(() => marker),
		polyline: vi.fn(() => polyline),
		icon: vi.fn(),
		divIcon: vi.fn(),
	};
	return { default: exports, ...exports };
});

import FlightPage from '../routes/flight/+page.svelte';

const AIRBORNE_RESPONSE = {
	ac: [{ flight: 'ELY90   ', lat: 20.0, lon: 70.0, alt_baro: 37000, gs: 480, track: 290 }],
};

const EMPTY_RESPONSE = { ac: [] };

function mockFetchWith(data: unknown) {
	(global.fetch as Mock).mockResolvedValue({
		ok: true,
		json: () => Promise.resolve(data),
	});
}

describe('Flight Tracker — LY90 HKT→TLV', () => {
	beforeEach(() => {
		global.fetch = vi.fn();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	// ── 1. Static flight info ───────────────────────────────────────────
	it('renders flight header with route info', async () => {
		mockFetchWith(EMPTY_RESPONSE);
		render(FlightPage);
		await waitFor(() => {
			expect(screen.getByText('LY90')).toBeInTheDocument();
			expect(screen.getByText(/HKT/)).toBeInTheDocument();
			expect(screen.getByText(/TLV/)).toBeInTheDocument();
			expect(screen.getByText(/Phuket/i)).toBeInTheDocument();
			expect(screen.getByText(/Tel Aviv/i)).toBeInTheDocument();
		});
	});

	it('shows scheduled departure and arrival times', async () => {
		mockFetchWith(EMPTY_RESPONSE);
		render(FlightPage);
		await waitFor(() => {
			expect(screen.getByText(/15:35/)).toBeInTheDocument();
			expect(screen.getByText(/01:40/)).toBeInTheDocument();
		});
	});

	// ── 2. Status badge logic ───────────────────────────────────────────
	it('shows "Airborne" status when API returns aircraft data', async () => {
		mockFetchWith(AIRBORNE_RESPONSE);
		render(FlightPage);
		await waitFor(() => {
			expect(screen.getByText(/Airborne/i)).toBeInTheDocument();
		});
	});

	it('shows "Not Departed" or "Landed" when API returns empty ac array', async () => {
		mockFetchWith(EMPTY_RESPONSE);
		render(FlightPage);
		await waitFor(() => {
			const status = screen.getByTestId('status-badge');
			const text = status.textContent ?? '';
			expect(text).toMatch(/Not Departed|Landed/i);
		});
	});

	// ── 3. Live telemetry data ──────────────────────────────────────────
	it('displays altitude, speed, and heading when airborne', async () => {
		mockFetchWith(AIRBORNE_RESPONSE);
		render(FlightPage);
		await waitFor(() => {
			expect(screen.getByText(/37[,.]?000/)).toBeInTheDocument(); // altitude in ft
			expect(screen.getByText(/480/)).toBeInTheDocument(); // ground speed in kts
			expect(screen.getByText(/290/)).toBeInTheDocument(); // heading in degrees
		});
	});

	it('hides live data or shows dashes when not airborne', async () => {
		mockFetchWith(EMPTY_RESPONSE);
		render(FlightPage);
		await waitFor(() => {
			// Either the live-data section is absent, or values show dashes
			const liveSection = screen.queryByTestId('live-data');
			if (liveSection) {
				expect(liveSection.textContent).toMatch(/[-–—]/);
			} else {
				expect(liveSection).toBeNull();
			}
		});
	});

	// ── 4. Map container ────────────────────────────────────────────────
	it('renders a map container element', async () => {
		mockFetchWith(EMPTY_RESPONSE);
		const { container } = render(FlightPage);
		await waitFor(() => {
			const mapEl =
				container.querySelector('[data-testid="map-container"]') ??
				container.querySelector('.leaflet-container') ??
				container.querySelector('#map');
			expect(mapEl).toBeTruthy();
		});
	});

	// ── 5. Fetch on mount ───────────────────────────────────────────────
	it('fetches ADSB data on mount', async () => {
		mockFetchWith(EMPTY_RESPONSE);
		render(FlightPage);
		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalled();
			const url = (global.fetch as Mock).mock.calls[0][0] as string;
			expect(url).toMatch(/adsb|adsbexchange|opensky|flight/i);
		});
	});
});
