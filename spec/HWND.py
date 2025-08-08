import win32gui


def enum_visible_windows():
    visible_hwnds = []

    def callback(hwnd, _):
        if win32gui.IsWindowVisible(hwnd):
            visible_hwnds.append(hwnd)
    win32gui.EnumWindows(callback, None)
    return visible_hwnds


def get_window_title(hwnd):
    return win32gui.GetWindowText(hwnd)

def get_parent_hwnd(hwnd):
    return win32gui.GetParent(hwnd)

def main():
    all_hwnds = enum_visible_windows()
    print("All HWNDs (Top-level and Child):")
    for hwnd in all_hwnds:
        title = get_window_title(hwnd)
        if( title != ''):
           print(f"HWND: {hwnd}, Title: '{title}'")

    try:
        user_input = int(input("\nEnter an HWND to find its parent: "))
        parent_hwnd = get_parent_hwnd(user_input)
        print(f"Parent HWND of {user_input}: {parent_hwnd}")
        print(f"Parent Title: '{get_window_title(parent_hwnd)}'")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
