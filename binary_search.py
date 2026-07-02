def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1

# 示例用法
if __name__ == '__main__':
    sorted_list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    target = 7
    result = binary_search(sorted_list, target)
    if result != -1:
        print(f'找到目标 {target} 在索引 {result}')
    else:
        print(f'未找到目标 {target}')